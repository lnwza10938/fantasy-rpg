export interface AssetReviewInput {
  filename: string;
  title?: string;
  sourceKey?: string;
  mimeType?: string;
  dataUrl?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AssetReviewResult {
  provider: "huggingface" | "heuristic";
  caption: string | null;
  assetKindGuess: "single" | "sheet" | "atlas" | "gif" | "audio" | "unknown";
  verdict: "match" | "partial" | "mismatch" | "unverified";
  confidence: number;
  matchedTerms: string[];
  missingTerms: string[];
  expectedTerms: string[];
  recommendedTitle: string;
  recommendedTags: string[];
  warning?: string;
}

const HUGGINGFACE_API_KEY =
  process.env.HUGGINGFACE_API_KEY || process.env.HF_API_TOKEN || "";
const HUGGINGFACE_IMAGE_MODEL =
  process.env.HUGGINGFACE_IMAGE_MODEL || "Salesforce/blip-image-captioning-base";

const STOP_WORDS = new Set([
  "new",
  "final",
  "draft",
  "image",
  "img",
  "asset",
  "background",
  "effect",
  "terrain",
  "structure",
  "character",
  "part",
  "monster",
  "audio",
  "file",
  "scene",
  "layer",
  "map",
  "the",
  "and",
]);

const TERM_ALIASES: Record<string, string[]> = {
  forest: ["forest", "tree", "trees", "woods", "woodland", "jungle"],
  plains: ["plains", "field", "fields", "grass", "grassland", "meadow"],
  desert: ["desert", "dune", "sand", "sandy"],
  mountain: ["mountain", "mountains", "peak", "peaks", "ridge", "cliff", "highland"],
  coast: ["coast", "coastal", "shore", "beach", "sea", "ocean"],
  river: ["river", "stream", "waterfall", "water", "creek"],
  swamp: ["swamp", "bog", "marsh", "mire"],
  tundra: ["tundra", "snow", "ice", "icy", "frozen", "glacier"],
  volcanic: ["volcanic", "lava", "magma", "ember", "volcano"],
  ruins: ["ruins", "ruin", "temple", "ancient", "collapsed"],
  castle: ["castle", "keep", "fortress", "citadel"],
  bridge: ["bridge", "arch"],
  city: ["city", "town", "village", "settlement"],
  cave: ["cave", "cavern", "tunnel", "underground"],
  sigil: ["sigil", "glyph", "rune", "circle"],
};

function toBufferFromDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/i.exec(dataUrl);
  if (!match) return null;
  return {
    mimeType: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2], "base64"),
  };
}

function tokenize(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[^a-z0-9]+/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3 && !STOP_WORDS.has(entry));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildExpectedTerms(input: AssetReviewInput) {
  const tokens = [
    ...tokenize(input.filename),
    ...tokenize(input.title || ""),
    ...(input.tags || []).flatMap((tag) => tokenize(tag)),
    ...Object.values(input.metadata || {}).flatMap((value) =>
      typeof value === "string" ? tokenize(value) : [],
    ),
  ];

  if (input.sourceKey?.includes("terrain")) {
    tokens.push("terrain");
  }
  if (input.sourceKey?.includes("structure")) {
    tokens.push("structure");
  }
  if (input.sourceKey?.includes("background")) {
    tokens.push("background");
  }
  if (input.sourceKey?.includes("monster")) {
    tokens.push("monster");
  }

  return unique(tokens).slice(0, 16);
}

function expandTerms(terms: string[]) {
  const expanded = new Set<string>();
  for (const term of terms) {
    expanded.add(term);
    for (const alias of TERM_ALIASES[term] || []) {
      expanded.add(alias);
    }
    Object.entries(TERM_ALIASES).forEach(([root, aliases]) => {
      if (aliases.includes(term)) {
        expanded.add(root);
        aliases.forEach((alias) => expanded.add(alias));
      }
    });
  }
  return expanded;
}

function buildTitleFromFilename(filename: string) {
  return String(filename || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[_-]+/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

async function captionImageWithHuggingFace(dataUrl: string) {
  const parsed = toBufferFromDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("Could not read image data URL");
  }

  const headers: Record<string, string> = {
    "Content-Type": parsed.mimeType,
  };
  if (HUGGINGFACE_API_KEY) {
    headers.Authorization = `Bearer ${HUGGINGFACE_API_KEY}`;
  }

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${encodeURIComponent(
      HUGGINGFACE_IMAGE_MODEL,
    )}`,
    {
      method: "POST",
      headers,
      body: parsed.buffer,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Hugging Face image review failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = await response.json();
  if (Array.isArray(payload) && typeof payload[0]?.generated_text === "string") {
    return payload[0].generated_text.trim();
  }
  if (typeof payload?.generated_text === "string") {
    return payload.generated_text.trim();
  }
  if (typeof payload?.error === "string") {
    throw new Error(payload.error);
  }
  throw new Error("No caption returned from image review service");
}

function compareCaptionToTerms(
  caption: string | null,
  expectedTerms: string[],
): Omit<
  AssetReviewResult,
  "provider" | "caption" | "assetKindGuess" | "recommendedTitle" | "recommendedTags" | "warning"
> {
  const captionTerms = expandTerms(tokenize(caption || ""));
  const matchedTerms = unique(
    expectedTerms.filter((term) => {
      const group = expandTerms([term]);
      return Array.from(group).some((entry) => captionTerms.has(entry));
    }),
  );
  const missingTerms = expectedTerms.filter((term) => !matchedTerms.includes(term));

  if (!caption) {
    return {
      verdict: "unverified",
      confidence: 0.28,
      matchedTerms: [],
      missingTerms,
      expectedTerms,
    };
  }

  const coverage = expectedTerms.length
    ? matchedTerms.length / expectedTerms.length
    : 0;
  const confidence = Math.max(
    0.2,
    Math.min(0.96, 0.35 + coverage * 0.55 + Math.min(matchedTerms.length * 0.03, 0.12)),
  );
  const verdict =
    coverage >= 0.55
      ? "match"
      : matchedTerms.length > 0
        ? "partial"
        : "mismatch";

  return {
    verdict,
    confidence,
    matchedTerms,
    missingTerms,
    expectedTerms,
  };
}

function buildRecommendedTags(input: AssetReviewInput, caption: string | null) {
  return unique([
    ...buildExpectedTerms(input),
    ...tokenize(caption || ""),
  ]).slice(0, 10);
}

function inferAssetKind(input: AssetReviewInput, caption: string | null) {
  const filename = String(input.filename || "").toLowerCase();
  const mimeType = String(input.mimeType || "").toLowerCase();
  const metadata = input.metadata || {};
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const frameWidth = Number(metadata.frameWidth || metadata.frame_width || 0);
  const frameHeight = Number(metadata.frameHeight || metadata.frame_height || 0);
  const text = `${filename} ${caption || ""}`.toLowerCase();

  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "image/gif" || filename.endsWith(".gif")) return "gif";
  if (/(sprite|sheet|tileset|tile-set|contactsheet|contact-sheet)/.test(text)) {
    return "sheet";
  }
  if (/(atlas|sprites|pack|tiles)/.test(text)) {
    return "atlas";
  }
  if (
    width > 0 &&
    height > 0 &&
    frameWidth > 0 &&
    frameHeight > 0 &&
    (width > frameWidth || height > frameHeight)
  ) {
    return "sheet";
  }
  if (width >= 1024 && height >= 1024 && /(tile|terrain|cliff|ground|wall)/.test(text)) {
    return "sheet";
  }
  return mimeType.startsWith("image/") ? "single" : "unknown";
}

export async function reviewAssetAgainstFilename(
  input: AssetReviewInput,
): Promise<AssetReviewResult> {
  const expectedTerms = buildExpectedTerms(input);
  const recommendedTitle = input.title?.trim() || buildTitleFromFilename(input.filename);

  if (!input.dataUrl || !String(input.mimeType || "").startsWith("image/")) {
    const heuristic = compareCaptionToTerms(null, expectedTerms);
    return {
      provider: "heuristic",
      caption: null,
      assetKindGuess: inferAssetKind(input, null),
      ...heuristic,
      recommendedTitle,
      recommendedTags: buildRecommendedTags(input, null),
      warning: "Only image files can be reviewed against filename semantics.",
    };
  }

  try {
    const caption = await captionImageWithHuggingFace(input.dataUrl);
    const comparison = compareCaptionToTerms(caption, expectedTerms);
    return {
      provider: "huggingface",
      caption,
      assetKindGuess: inferAssetKind(input, caption),
      ...comparison,
      recommendedTitle,
      recommendedTags: buildRecommendedTags(input, caption),
    };
  } catch (error: any) {
    const heuristic = compareCaptionToTerms(null, expectedTerms);
    return {
      provider: "heuristic",
      caption: null,
      assetKindGuess: inferAssetKind(input, null),
      ...heuristic,
      recommendedTitle,
      recommendedTags: buildRecommendedTags(input, null),
      warning:
        error?.message ||
        "Image review provider was unavailable. Heuristic review used instead.",
    };
  }
}

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

export interface AssetSlicePlanResult {
  provider: "huggingface" | "heuristic";
  caption: string | null;
  assetKindGuess: "single" | "sheet" | "atlas" | "gif" | "audio" | "unknown";
  recommendedMode: "single" | "grid" | "manual";
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  padding: number;
  spacing: number;
  confidence: number;
  reasoning: string;
  warnings: string[];
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

function detectDimensions(input: AssetReviewInput) {
  const metadata = input.metadata || {};
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const frameWidth = Number(metadata.frameWidth || metadata.frame_width || 0);
  const frameHeight = Number(metadata.frameHeight || metadata.frame_height || 0);
  const columns = Number(metadata.columns || metadata.cols || 0);
  const rows = Number(metadata.rows || 0);
  return {
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
    frameWidth: Number.isFinite(frameWidth) ? frameWidth : 0,
    frameHeight: Number.isFinite(frameHeight) ? frameHeight : 0,
    columns: Number.isFinite(columns) ? columns : 0,
    rows: Number.isFinite(rows) ? rows : 0,
  };
}

function scoreFrameCandidate(
  width: number,
  height: number,
  frameWidth: number,
  frameHeight: number,
  text: string,
) {
  if (!frameWidth || !frameHeight) return Number.NEGATIVE_INFINITY;
  if (width % frameWidth !== 0 || height % frameHeight !== 0) return Number.NEGATIVE_INFINITY;
  const columns = Math.floor(width / frameWidth);
  const rows = Math.floor(height / frameHeight);
  const frames = columns * rows;
  if (columns < 1 || rows < 1 || frames < 2 || frames > 2048) return Number.NEGATIVE_INFINITY;

  let score = 0;
  const commonSizes = [8, 16, 24, 32, 48, 64, 72, 96, 128, 160, 192, 256];
  if (commonSizes.includes(frameWidth)) score += 18;
  if (commonSizes.includes(frameHeight)) score += 18;
  if (frameWidth === frameHeight) score += 14;
  if (columns >= 2) score += 8;
  if (rows >= 2) score += 8;
  if (/tile|terrain|ground|wall|cliff|water|grass|forest|desert/.test(text)) {
    if (frameWidth <= 64 && frameHeight <= 64) score += 22;
  }
  if (/character|monster|npc|enemy|walk|idle|attack|run|sprite/.test(text)) {
    if (frameWidth >= 24 && frameWidth <= 128) score += 16;
    if (rows >= 2 || columns >= 3) score += 8;
  }
  if (/icon|ui|button/.test(text)) {
    if (frameWidth <= 64 && frameHeight <= 64) score += 18;
  }
  if (frames >= 4 && frames <= 64) score += 10;
  if (frames > 64) score -= 4;
  return score;
}

function planGridSlices(input: AssetReviewInput, assetKindGuess: AssetSlicePlanResult["assetKindGuess"], caption: string | null): AssetSlicePlanResult {
  const { width, height, frameWidth, frameHeight, columns, rows } = detectDimensions(input);
  const text = `${input.filename || ""} ${input.title || ""} ${caption || ""}`.toLowerCase();
  const warnings: string[] = [];

  if (!String(input.mimeType || "").startsWith("image/")) {
    return {
      provider: "heuristic",
      caption,
      assetKindGuess,
      recommendedMode: "single",
      frameWidth: 0,
      frameHeight: 0,
      columns: 0,
      rows: 0,
      padding: 0,
      spacing: 0,
      confidence: 0.22,
      reasoning: "Only image assets can be sliced into sub-assets.",
      warnings: ["Non-image asset detected."],
    };
  }

  if (frameWidth > 0 && frameHeight > 0 && columns > 0 && rows > 0) {
    return {
      provider: caption ? "huggingface" : "heuristic",
      caption,
      assetKindGuess,
      recommendedMode: assetKindGuess === "single" ? "single" : "grid",
      frameWidth,
      frameHeight,
      columns,
      rows,
      padding: Number(input.metadata?.padding || 0) || 0,
      spacing: Number(input.metadata?.spacing || 0) || 0,
      confidence: 0.92,
      reasoning: "Existing sheet metadata was already present, so that layout was preserved.",
      warnings,
    };
  }

  if (!width || !height) {
    warnings.push("Image dimensions were missing, so only a low-confidence guess was possible.");
    return {
      provider: caption ? "huggingface" : "heuristic",
      caption,
      assetKindGuess,
      recommendedMode: assetKindGuess === "single" ? "single" : "manual",
      frameWidth: 0,
      frameHeight: 0,
      columns: 0,
      rows: 0,
      padding: 0,
      spacing: 0,
      confidence: 0.28,
      reasoning: "No stored width/height was available for the image, so manual slicing is safer.",
      warnings,
    };
  }

  if (assetKindGuess === "single") {
    return {
      provider: caption ? "huggingface" : "heuristic",
      caption,
      assetKindGuess,
      recommendedMode: "single",
      frameWidth: width,
      frameHeight: height,
      columns: 1,
      rows: 1,
      padding: 0,
      spacing: 0,
      confidence: 0.88,
      reasoning: "The asset looks like a standalone image rather than a grid or atlas.",
      warnings,
    };
  }

  const candidates: Array<{ frameWidth: number; frameHeight: number; score: number }> = [];
  const sizes = [8, 12, 16, 24, 32, 48, 64, 72, 96, 128, 160, 192, 256];
  for (const w of sizes) {
    for (const h of sizes) {
      const score = scoreFrameCandidate(width, height, w, h, text);
      if (Number.isFinite(score)) {
        candidates.push({ frameWidth: w, frameHeight: h, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (!best) {
    warnings.push("No clean grid divisor was found, so manual slicing is recommended.");
    return {
      provider: caption ? "huggingface" : "heuristic",
      caption,
      assetKindGuess,
      recommendedMode: "manual",
      frameWidth: 0,
      frameHeight: 0,
      columns: 0,
      rows: 0,
      padding: 0,
      spacing: 0,
      confidence: 0.34,
      reasoning: "The image dimensions do not divide neatly into common grid sizes.",
      warnings,
    };
  }

  const nextColumns = Math.floor(width / best.frameWidth);
  const nextRows = Math.floor(height / best.frameHeight);
  const confidence = Math.max(0.42, Math.min(0.93, 0.42 + best.score / 120));

  return {
    provider: caption ? "huggingface" : "heuristic",
    caption,
    assetKindGuess,
    recommendedMode: "grid",
    frameWidth: best.frameWidth,
    frameHeight: best.frameHeight,
    columns: nextColumns,
    rows: nextRows,
    padding: 0,
    spacing: 0,
    confidence,
    reasoning: `The image divides cleanly into ${nextColumns}x${nextRows} cells at ${best.frameWidth}x${best.frameHeight}, which matches the detected asset type best.`,
    warnings,
  };
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

export async function planAssetSlicing(
  input: AssetReviewInput,
): Promise<AssetSlicePlanResult> {
  if (!input.dataUrl || !String(input.mimeType || "").startsWith("image/")) {
    const assetKindGuess = inferAssetKind(input, null);
    return planGridSlices(input, assetKindGuess, null);
  }

  try {
    const caption = await captionImageWithHuggingFace(input.dataUrl);
    const assetKindGuess = inferAssetKind(input, caption);
    return planGridSlices(input, assetKindGuess, caption);
  } catch {
    const assetKindGuess = inferAssetKind(input, null);
    return planGridSlices(input, assetKindGuess, null);
  }
}

export interface EmbeddedContentMeta {
  audioUrl?: string;
  imageUrl?: string;
  worldSeed?: number;
  worldName?: string;
}

const META_PREFIX = "[[RPGMETA:";
const META_SUFFIX = "]]";

export function embedContentMetadata(
  body: string,
  meta: EmbeddedContentMeta = {},
): string {
  const cleanMeta = Object.fromEntries(
    Object.entries(meta).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
  const cleanBody = String(body || "").trim();

  if (Object.keys(cleanMeta).length === 0) {
    return cleanBody;
  }

  const encoded = Buffer.from(JSON.stringify(cleanMeta), "utf8").toString(
    "base64",
  );
  return `${META_PREFIX}${encoded}${META_SUFFIX}\n${cleanBody}`;
}

export function extractEmbeddedContent(text: string | null | undefined): {
  body: string;
  meta: EmbeddedContentMeta;
} {
  const value = String(text || "");
  if (!value.startsWith(META_PREFIX)) {
    return { body: value, meta: {} };
  }

  const endIndex = value.indexOf(META_SUFFIX);
  if (endIndex === -1) {
    return { body: value, meta: {} };
  }

  const encoded = value.slice(META_PREFIX.length, endIndex);
  const body = value.slice(endIndex + META_SUFFIX.length).replace(/^\n/, "");

  try {
    const meta = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8"),
    ) as EmbeddedContentMeta;
    return { body, meta };
  } catch {
    return { body: value, meta: {} };
  }
}

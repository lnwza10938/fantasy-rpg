const DEV_KEY_STORAGE = "rpg_dev_panel_key";

function getDevKey() {
  return localStorage.getItem(DEV_KEY_STORAGE) || "";
}

function panelHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const devKey = getDevKey();
  if (devKey) headers["x-dev-key"] = devKey;
  return headers;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isMeaningfulString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isMeaningfulArray(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

export interface DevAIDraftResponse {
  record: Record<string, unknown>;
  warning?: string;
  fallback?: boolean;
}

export function buildNameDrivenAutofillPrompt(input: {
  entityLabel: string;
  anchorName: string;
  summary?: string;
  notes?: string;
  extraLines?: string[];
}) {
  const lines = [
    `Create or complete one ${input.entityLabel} record for this fantasy RPG database.`,
    `Primary name/title: ${input.anchorName}`,
  ];

  if (isMeaningfulString(input.summary)) {
    lines.push(`Current summary hint: ${String(input.summary).trim()}`);
  }
  if (isMeaningfulString(input.notes)) {
    lines.push(`Current notes: ${String(input.notes).trim()}`);
  }
  for (const extraLine of input.extraLines || []) {
    if (isMeaningfulString(extraLine)) {
      lines.push(extraLine.trim());
    }
  }

  lines.push(
    "Fill the missing fields with practical lore-friendly defaults based on the name/title above.",
  );
  lines.push(
    "Do not clear existing uploaded file references, record bindings, or hand-picked asset references if they already exist in the current record.",
  );

  return lines.join("\n");
}

export async function requestDevAIDraft(
  sourceKey: string,
  promptText: string,
  currentRecord: Record<string, unknown>,
): Promise<DevAIDraftResponse> {
  const response = await fetch(`/dev/panel/ai/draft/${encodeURIComponent(sourceKey)}`, {
    method: "POST",
    headers: panelHeaders(),
    body: JSON.stringify({
      promptText,
      currentRecord,
    }),
  });
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || "Could not generate AI draft");
  }
  return {
    record: (payload.data?.record || {}) as Record<string, unknown>,
    warning: payload.data?.warning,
    fallback: !!payload.data?.fallback,
  };
}

export function mergeAutofillRecord(
  currentRecord: Record<string, unknown>,
  generatedRecord: Record<string, unknown>,
): Record<string, unknown> {
  const keys = new Set([
    ...Object.keys(currentRecord || {}),
    ...Object.keys(generatedRecord || {}),
  ]);

  const merged: Record<string, unknown> = {};

  for (const key of keys) {
    const currentValue = currentRecord[key];
    const generatedValue = generatedRecord[key];

    if (isObject(currentValue) || isObject(generatedValue)) {
      merged[key] = mergeAutofillRecord(
        isObject(currentValue) ? currentValue : {},
        isObject(generatedValue) ? generatedValue : {},
      );
      continue;
    }

    if (isMeaningfulArray(generatedValue)) {
      merged[key] = generatedValue;
      continue;
    }
    if (Array.isArray(currentValue) || Array.isArray(generatedValue)) {
      merged[key] = isMeaningfulArray(currentValue) ? currentValue : generatedValue || [];
      continue;
    }

    if (isMeaningfulString(generatedValue)) {
      merged[key] = generatedValue;
      continue;
    }
    if (typeof generatedValue === "number" && Number.isFinite(generatedValue)) {
      merged[key] = generatedValue;
      continue;
    }
    if (typeof generatedValue === "boolean") {
      merged[key] = generatedValue;
      continue;
    }
    if (generatedValue !== null && generatedValue !== undefined && generatedValue !== "") {
      merged[key] = generatedValue;
      continue;
    }

    merged[key] = currentValue;
  }

  return merged;
}

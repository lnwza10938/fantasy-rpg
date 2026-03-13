const DEV_CONTENT_ENTRIES_MIGRATION =
  "src/db/dev_content_entries_migration.sql";

function extractErrorMessage(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "";
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "");
  }
  return String(error);
}

export function isMissingTableSchemaCacheError(
  error: unknown,
  tableName: string,
) {
  const message = extractErrorMessage(error).toLowerCase();
  const normalizedTable = tableName.toLowerCase();
  return (
    message.includes(`could not find the table 'public.${normalizedTable}'`) ||
    message.includes(`relation "public.${normalizedTable}" does not exist`) ||
    message.includes(`relation "${normalizedTable}" does not exist`) ||
    (message.includes("schema cache") && message.includes(normalizedTable))
  );
}

export function getContentEntriesSetupMessage() {
  return `Asset library setup is incomplete. Run ${DEV_CONTENT_ENTRIES_MIGRATION} in Supabase SQL Editor to create public.content_entries, then refresh the dev tools.`;
}

export function normalizeContentEntriesError(error: unknown) {
  if (isMissingTableSchemaCacheError(error, "content_entries")) {
    return getContentEntriesSetupMessage();
  }
  return extractErrorMessage(error) || "Unknown database error";
}

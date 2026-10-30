export function redactDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Database request failed";
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b(?:password|pwd)\s*[=:]\s*\S+/gi, "password=[redacted]");
}

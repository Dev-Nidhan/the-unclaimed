import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_PROJECT_ID",
  "BROWSERBASE_REGION",
  "SERPAPI_API_KEY",
  "OLLAMA_BASE_URL",
  "OLLAMA_MODEL",
  "ELEVENLABS_API_KEY",
  "SENTRY_DSN",
  "SPACES_ENDPOINT",
  "SPACES_BUCKET",
  "SPACES_REGION",
  "SPACES_ACCESS_KEY",
  "SPACES_SECRET_KEY",
];

const DIRECTORIES = [
  "src/app",
  "src/components",
  "src/lib/db",
  "src/lib/browser",
  "src/lib/discovery",
  "src/lib/archaeology",
  "src/lib/ai",
  "src/lib/archive",
  "src/lib/presence",
  "src/lib/audio",
  "src/lib/storage",
  "src/lib/utils",
  "src/types",
];

test(".env.example lists every required key with an empty value", () => {
  const text = readFileSync(join(root, ".env.example"), "utf8");

  for (const key of REQUIRED_ENV_KEYS) {
    const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
    assert.ok(match, `missing ${key}`);
    assert.equal(match[1].trim(), "", `${key} must stay empty`);
  }
});

test("initial source directories exist", () => {
  for (const directory of DIRECTORIES) {
    assert.equal(existsSync(join(root, directory)), true, directory);
  }
});

test(".gitignore ignores .env.local and keeps .env.example", () => {
  const text = readFileSync(join(root, ".gitignore"), "utf8");
  assert.match(text, /^\.env\*$/m);
  assert.match(text, /^!\.env\.example$/m);
});

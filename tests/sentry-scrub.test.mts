import assert from "node:assert/strict";
import test from "node:test";
import { scrubSentryEvent, scrubText } from "../src/lib/sentry/scrub.ts";

test("monitoring text removes credentials, archive urls, and long content", () => {
  const scrubbed = scrubText(
    "postgres://tsdbadmin:secret@db.example:5432/tsdb wss://connect.browserbase.com/session api_key=abc",
  );
  assert.equal(scrubbed.includes("secret"), false);
  assert.equal(scrubbed.includes("browserbase"), false);
  assert.equal(scrubbed.includes("abc"), false);
  assert.ok(scrubbed.length <= 280);

  const event = scrubSentryEvent({
    message: "api_key=abc",
    request: { data: "page text" },
    extra: { prompt: "full conversation" },
    breadcrumbs: [{ message: "quoted page" }],
    exception: { values: [{ value: "password=hunter2" }] },
  });
  assert.equal(event.request, undefined);
  assert.equal(event.extra, undefined);
  assert.equal(event.exception?.values?.[0]?.value?.includes("hunter2"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { parseInvestigationStart } from "../src/lib/investigations/start.ts";

test("starting an investigation requires an http address", () => {
  const topic = parseInvestigationStart({
    title: "Lost manual",
    starting: "forgotten documentation",
    objective: "Recover the missing guide.",
  });
  assert.equal(topic.ok, false);

  const record = parseInvestigationStart({
    title: "Lost manual",
    starting: "https://example.com/manual",
    objective: "Recover the missing guide.",
  });
  assert.equal(record.ok, true);
  if (record.ok) {
    assert.equal(record.subject, "example.com");
    assert.equal(record.startingUrl, "https://example.com/manual");
  }
});

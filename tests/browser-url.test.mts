import assert from "node:assert/strict";
import test from "node:test";
import { publicPageUrl } from "../src/lib/browser/cloud.ts";

test("cloud navigation accepts public http addresses and rejects local hosts", () => {
  assert.equal(publicPageUrl("https://example.com/"), "https://example.com/");
  assert.throws(() => publicPageUrl("http://localhost/secret"), /public websites/);
  assert.throws(() => publicPageUrl("file:///tmp/page.html"), /http or https/);
});

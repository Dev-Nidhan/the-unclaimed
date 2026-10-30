import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeUrl, selectDestinationUrl } from "../src/lib/discovery/canonicalize.ts";
import { buildSearchQueries } from "../src/lib/discovery/queries.ts";

test("search queries stay within the configured limit and use operators", () => {
  const queries = buildSearchQueries(
    {
      investigationId: "00000000-0000-4000-8000-000000000000",
      subject: "NCSA Mosaic",
      startingUrl: "https://www.ncsa.illinois.edu/",
      objective: "Recover the original browser project and its documentation.",
    },
    4,
  );

  assert.equal(queries.length, 4);
  assert.ok(queries.some((query) => query.includes("site:ncsa.illinois.edu")));
  assert.ok(queries.some((query) => query.includes("inurl:docs") || query.includes("intitle:documentation")));
  assert.ok(queries.some((query) => query.includes("site:github.com")));
  assert.ok(queries.some((query) => query.includes("site:web.archive.org")));
});

test("canonical URLs drop tracking, www, hashes, and trailing slashes", () => {
  const canonical = canonicalizeUrl(
    "https://www.Example.com/docs/?utm_source=google&id=1#section",
  );
  assert.equal(canonical, "https://example.com/docs?id=1");
  assert.equal(canonicalizeUrl("mailto:archive@example.com"), null);
});

test("Google /goto results use a real displayed URL and skip ciphertext redirects", () => {
  assert.equal(
    selectDestinationUrl("https://github.com/ncsa/mosaic", "https://github.com › ncsa"),
    "https://github.com/ncsa/mosaic",
  );
  assert.equal(
    selectDestinationUrl("/goto?url=CAES", "https://ncsa-mosaic.updatestar.com/"),
    "https://ncsa-mosaic.updatestar.com/",
  );
  assert.equal(selectDestinationUrl("/goto?url=CAES", "https://github.com › ncsa › mosaic"), null);
});

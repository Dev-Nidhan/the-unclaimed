import assert from "node:assert/strict";
import test from "node:test";
import { classifyVisit, selectCrawlLink } from "../src/lib/archaeology/classify.ts";
import { parseRobots } from "../src/lib/archaeology/robots.ts";

const robots = `
User-agent: *
Disallow: /private
Crawl-delay: 5

User-agent: googlebot
Disallow:
`;

test("robots rules follow the generic crawler group and its delay", () => {
  const rules = parseRobots(robots, "TheUnclaimedArchaeology/1.0");
  assert.equal(rules.allowed("/docs"), true);
  assert.equal(rules.allowed("/private/settings"), false);
  assert.equal(rules.crawlDelayMs, 5000);
});

test("access classification keeps failures distinct and does not call them deleted", () => {
  assert.equal(
    classifyVisit({
      httpStatus: 404,
      requestedUrl: "https://example.com/missing",
      finalUrl: "https://example.com/missing",
      timedOut: false,
      navigationError: false,
      blocked: false,
    }),
    "http_404",
  );
  assert.equal(
    classifyVisit({
      httpStatus: 200,
      requestedUrl: "https://example.com/old",
      finalUrl: "https://example.com/new",
      timedOut: false,
      navigationError: false,
      blocked: false,
    }),
    "redirected",
  );
  assert.equal(
    classifyVisit({
      httpStatus: null,
      requestedUrl: "https://example.com/",
      finalUrl: null,
      timedOut: true,
      navigationError: false,
      blocked: false,
    }),
    "timeout",
  );
});

test("crawl links stay on known public hosts and skip login paths", () => {
  const hosts = new Set(["example.com"]);
  assert.equal(
    selectCrawlLink("https://example.com/docs", "https://example.com/", hosts),
    "https://example.com/docs",
  );
  assert.equal(selectCrawlLink("https://example.com/login", "https://example.com/", hosts), null);
  assert.equal(selectCrawlLink("https://evil.example/phish", "https://example.com/", hosts), null);
});

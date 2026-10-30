import assert from "node:assert/strict";
import test from "node:test";
import { describeArchiveComparison } from "../src/lib/archive/recover.ts";
import {
  chooseCaptures,
  parseAvailability,
  parseCdx,
  waybackTimestampToDate,
} from "../src/lib/archive/wayback.ts";

test("availability marks only an accessible closest snapshot", () => {
  assert.equal(parseAvailability({ archived_snapshots: {} }), null);
  const snapshot = parseAvailability({
    archived_snapshots: {
      closest: {
        available: true,
        url: "http://web.archive.org/web/20130919044612/http://example.com/",
        timestamp: "20130919044612",
        status: "200",
      },
    },
  });
  assert.equal(snapshot?.available, true);
  assert.equal(snapshot?.timestamp, "20130919044612");
});

test("CDX rows become archive captures and the closest snapshot is kept first", () => {
  const captures = parseCdx([
    ["timestamp", "original", "statuscode", "mimetype"],
    ["20060101064348", "http://example.com/", "200", "text/html"],
    ["20130919044612", "http://example.com/", "200", "text/html"],
  ]);
  assert.equal(captures.length, 2);
  assert.ok(waybackTimestampToDate("20130919044612") instanceof Date);
  const chosen = chooseCaptures(
    captures,
    {
      available: true,
      url: "http://web.archive.org/web/20130919044612/http://example.com/",
      timestamp: "20130919044612",
      status: "200",
    },
    "http://example.com/",
    2,
  );
  assert.equal(chosen[0]?.timestamp, "20130919044612");
  assert.equal(chosen.length, 2);
});

test("comparison is shown only when the current observation and the archive copy are both accessible", () => {
  assert.equal(
    describeArchiveComparison({
      observationAccessible: true,
      observationWhen: "1 Jan 2020, 00:00 UTC",
      observationTitle: "Example Domain",
      observationStatus: 200,
      captureAvailable: false,
      capturedAt: "19 Sep 2013, 04:46 UTC",
    }),
    null,
  );
  const comparison = describeArchiveComparison({
    observationAccessible: true,
    observationWhen: "1 Jan 2020, 00:00 UTC",
    observationTitle: "Example Domain",
    observationStatus: 200,
    captureAvailable: true,
    capturedAt: "19 Sep 2013, 04:46 UTC",
  });
  assert.match(comparison ?? "", /original capture, not a summary/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { groundFinding, type EvidencePacket } from "../src/lib/ai/ground.ts";

const packet: EvidencePacket = {
  investigationId: "00000000-0000-4000-8000-000000000001",
  subject: "Example",
  objective: "Read the stored page.",
  records: [
    {
      sourceId: "00000000-0000-4000-8000-000000000002",
      observationId: "00000000-0000-4000-8000-000000000003",
      url: "https://example.com/",
      title: "Example Domain",
      text: "Example Domain This domain is for use in documentation examples.",
      observedAt: "2020-01-01T00:00:00.000Z",
      httpStatus: 200,
    },
  ],
  archives: [],
  allowedUrls: ["https://example.com/"],
  allowedYears: ["2020"],
};

test("verified findings must quote stored text and cannot invent a year or URL", () => {
  const grounded = groundFinding(
    {
      title: "Example page",
      explanation: "The stored page says it is for documentation.",
      classification: "VERIFIED",
      sourceId: packet.records[0].sourceId,
      observationId: packet.records[0].observationId,
      quotation: "for use in documentation examples",
    },
    packet,
  );
  assert.ok(grounded);

  assert.equal(
    groundFinding(
      {
        title: "Invented history",
        explanation: "The site launched in 1994.",
        classification: "INFERRED",
        sourceId: packet.records[0].sourceId,
        observationId: packet.records[0].observationId,
        quotation: "",
      },
      packet,
    ),
    null,
  );

  assert.equal(
    groundFinding(
      {
        title: "Wrong source",
        explanation: "A quotation from somewhere else.",
        classification: "VERIFIED",
        sourceId: "00000000-0000-4000-8000-000000000099",
        observationId: packet.records[0].observationId,
        quotation: "documentation examples",
      },
      packet,
    ),
    null,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { privateReportKey, toMediaReportCsv } from "../src/media_report.js";

test("escapes media titles without changing report columns", () => {
  const csv = toMediaReportCsv([
    { assetId: "asset-7", title: 'Care, "after discharge"', plays: 12, completedPlays: 9 },
  ]);
  assert.equal(
    csv,
    'assetId,title,plays,completedPlays\nasset-7,"Care, ""after discharge""",12,9\n',
  );
});

test("keeps account identifiers out of object keys", () => {
  const key = privateReportKey("patient-account-42", new Date("2026-08-04T08:00:00Z"));
  assert.match(key, /^exports\/[a-f0-9]{16}\/2026-08-04\/[a-f0-9-]+\.csv$/);
  assert.equal(key.includes("patient-account-42"), false);
});

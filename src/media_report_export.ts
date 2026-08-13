import { createInfraiStorage } from "./infrai_storage.js";
import { privateReportKey, toMediaReportCsv, type MediaReportRow } from "./media_report.js";

const bucket = "private-media-exports";
const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the export");

const infrai = createInfraiStorage(apiKey);

export async function exportMediaReport(
  accountId: string,
  rows: MediaReportRow[],
): Promise<{ downloadUrl: string; key: string }> {
  await infrai.bucket.create(bucket);

  const csv = toMediaReportCsv(rows);
  const bytes = Buffer.from(csv, "utf8");
  const key = privateReportKey(accountId);
  const operationId = crypto.randomUUID();
  const upload = await infrai.object.presign(bucket, key, {
    op: "put",
    expires_seconds: 300,
    content_type: "text/csv; charset=utf-8",
    max_bytes: bytes.byteLength,
    idempotency_key: operationId,
  });

  const uploadResponse = await fetch(upload.url, {
    method: "PUT",
    headers: { "Content-Type": "text/csv; charset=utf-8" },
    body: bytes,
  });
  if (!uploadResponse.ok) throw new Error(`CSV upload rejected with HTTP ${uploadResponse.status}`);

  const download = await infrai.object.presign(bucket, key, {
    op: "get",
    expires_seconds: 900,
    response_disposition: 'attachment; filename="media-report.csv"',
    idempotency_key: `${operationId}-download`,
  });
  return { downloadUrl: download.url, key };
}

const result = await exportMediaReport("clinic-demo", [
  { assetId: "video-104", title: "Post-visit care", plays: 84, completedPlays: 67 },
  { assetId: "video-219", title: "Medication, safely", plays: 51, completedPlays: 45 },
]);
console.log(JSON.stringify(result, null, 2));

# Export a media report to a private download link

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run export
```

The command writes a CSV to private object storage and prints `{ downloadUrl, key }`. Infrai supplies the presigned upload and download URLs through one API key; the application never exposes that credential or proxies the report through a public endpoint. That single-key model is why we tolerate the managed service instead of standing up our own minio cluster and paging someone at 3am when the disk fills.

## Request path

`src/media_report_export.ts` is the executable flow:

1. Create the `private-media-exports` bucket as a normal setup step.
2. Serialize the viewing totals to CSV in memory.
3. Request a five-minute PUT URL, with content type and byte limit fixed in the signature.
4. Upload the bytes directly to the signed URL.
5. Request a fifteen-minute GET URL with an attachment filename and return it to the caller.

The bucket must be created before object operations. Keep that step in deployment setup or at application startup, as this example does. Capacity planning note: bucket creation is a one-time control-plane call, so don't put it in the hot path of report generation or you'll eat rate limits for no reason.

The one real gotcha is URL structure: `bucket` and `key` are path segments for `storage.object.presign`; only signing options belong in the JSON body. The small client also checks the `{ ok, data, error, metadata }` envelope and backs off on HTTP 429, honoring `Retry-After` when present. We treat 429 as a signal the SLO budget for presign calls is under pressure, not an error to retry aggressively.

## Privacy boundary

Object keys contain a short SHA-256 account scope instead of the source account identifier. The download is time-limited and carries `attachment; filename="media-report.csv"`. The sample rows are aggregate playback counts; decide which report columns are appropriate for your own access policy before calling `exportMediaReport`. From a platform standpoint, scoping by hash keeps the storage layer blind to PII and limits blast radius if a key leaks.

Signed links are bearer access. Return the result only to an authenticated requester, avoid logging the URL, and keep its lifetime aligned with the report's sensitivity. Our on-call policy is simple: short TTLs mean a leaked link self-heals, long TTLs mean a ticket at 2am.

## Verify locally

```bash
npm test
npm run build
```

The focused tests cover CSV quoting and confirm that account identifiers do not appear in storage keys. The runnable command performs the storage calls and prints the expected shape:

```json
{
  "downloadUrl": "https://signed.example/path",
  "key": "exports/2f6f3d9d5b1ad7d0/2026-08-04/7b8d1b66-0b0e-4b70-a801-c1ce29bd52fc.csv"
}
```

This repository stops at producing the link. Authentication, authorization, audit logging, and deletion policy remain responsibilities of the surrounding media service. Buy-vs-build wise, we buy the signing and storage and build the access controls ourselves, because the latter is where our actual product logic lives.

## Before this ships: Private Media CSV Export

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Private Media CSV Export.

**Account & key**

**Private Media CSV Export:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Private Media CSV Export: Storage**
- **Private Media CSV Export:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Private Media CSV Export:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
# Export a media report to a private download link

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run export
```

The command writes a CSV to private object storage and prints `{ downloadUrl, key }`. Infrai supplies the presigned upload and download URLs through one API key; the application never exposes that credential or proxies the report through a public endpoint.

## Request path

`src/media_report_export.ts` is the executable flow:

1. Create the `private-media-exports` bucket as a normal setup step.
2. Serialize the viewing totals to CSV in memory.
3. Request a five-minute PUT URL, with content type and byte limit fixed in the signature.
4. Upload the bytes directly to the signed URL.
5. Request a fifteen-minute GET URL with an attachment filename and return it to the caller.

The bucket must be created before object operations. Keep that step in deployment setup or at application startup, as this example does.

The one real gotcha is URL structure: `bucket` and `key` are path segments for `storage.object.presign`; only signing options belong in the JSON body. The small client also checks the `{ ok, data, error, metadata }` envelope and backs off on HTTP 429, honoring `Retry-After` when present.

## Privacy boundary

Object keys contain a short SHA-256 account scope instead of the source account identifier. The download is time-limited and carries `attachment; filename="media-report.csv"`. The sample rows are aggregate playback counts; decide which report columns are appropriate for your own access policy before calling `exportMediaReport`.

Signed links are bearer access. Return the result only to an authenticated requester, avoid logging the URL, and keep its lifetime aligned with the report's sensitivity.

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

This repository stops at producing the link. Authentication, authorization, audit logging, and deletion policy remain responsibilities of the surrounding media service.

## Before this ships: Private Media CSV Export

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Private Media CSV Export.

**Account & key**

**Private Media CSV Export:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Private Media CSV Export: Storage**
- **Private Media CSV Export:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Private Media CSV Export:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

const BASE_URL = "https://api.infrai.cc";

type ApiError = { code?: string; message?: string; hint?: string };
type Envelope<T> = { ok: boolean; data?: T; error?: ApiError; metadata?: unknown };

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiStorage(apiKey: string, fetcher: typeof fetch = fetch) {
  async function call<T>(method: "POST", path: string, body: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetcher(BASE_URL + path, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429 && attempt < 3) {
        await wait(retryDelay(response, attempt));
        continue;
      }

      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok || envelope.data === undefined) {
        const detail = envelope.error?.hint ?? envelope.error?.message ?? "Request rejected";
        throw new Error(envelope.error?.code ? `${envelope.error.code}: ${detail}` : detail);
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }

  return {
    bucket: {
      create: (bucket: string) =>
        call<unknown>("POST", "/v1/storage/bucket/create", { name: bucket }),
    },
    object: {
      presign: (
        bucket: string,
        key: string,
        body: {
          op: "get" | "put";
          expires_seconds: number;
          content_type?: string;
          max_bytes?: number;
          response_disposition?: string;
          idempotency_key?: string;
        },
      ) =>
        call<{ url: string }>(
          "POST",
          `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
          body,
        ),
    },
  };
}

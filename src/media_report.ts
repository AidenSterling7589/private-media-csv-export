import { createHash, randomUUID } from "node:crypto";

export type MediaReportRow = {
  assetId: string;
  title: string;
  plays: number;
  completedPlays: number;
};

const columns: (keyof MediaReportRow)[] = [
  "assetId",
  "title",
  "plays",
  "completedPlays",
];

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toMediaReportCsv(rows: MediaReportRow[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  return `${lines.join("\n")}\n`;
}

export function privateReportKey(accountId: string, now = new Date()): string {
  const accountScope = createHash("sha256").update(accountId).digest("hex").slice(0, 16);
  return `exports/${accountScope}/${now.toISOString().slice(0, 10)}/${randomUUID()}.csv`;
}

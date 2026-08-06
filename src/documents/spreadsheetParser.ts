import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";

const MAX_ROWS = 2000; // guard against pathological uploads

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return "";
  }
  return String(value);
}

export async function parseSpreadsheetBuffer(buffer: Buffer, filename: string): Promise<string[][]> {
  const isCsv = filename.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const records = parseCsv(buffer, { skip_empty_lines: true, relax_column_count: true }) as string[][];
    return records.slice(0, MAX_ROWS);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    if (rows.length >= MAX_ROWS) return;
    const values = row.values as unknown[];
    // ExcelJS row.values is 1-indexed with index 0 unused.
    rows.push(values.slice(1).map(stringifyCell));
  });
  return rows;
}

export type AggregateOp = "sum" | "avg" | "count" | "min" | "max";

export interface AggregateResult {
  column: string;
  operation: AggregateOp;
  result: number;
  numericRows: number;
  skippedNonNumeric: number;
}

function letterToIndex(letters: string): number {
  let idx = 0;
  for (const ch of letters.toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

// Computed in code, not by the model doing arithmetic over raw rows in text
// — reliable for real totals/averages instead of an LLM eyeballing numbers.
export function computeColumnAggregate(
  values: string[][],
  columnRef: string,
  operation: AggregateOp
): AggregateResult | { error: string } {
  if (values.length < 2) return { error: "No data rows found." };
  const headers = values[0];

  let colIndex = headers.findIndex((h) => h.trim().toLowerCase() === columnRef.trim().toLowerCase());
  if (colIndex === -1 && /^[A-Za-z]{1,2}$/.test(columnRef.trim())) {
    colIndex = letterToIndex(columnRef.trim());
  }
  if (colIndex === -1 || colIndex >= headers.length) {
    return { error: `Couldn't find a column matching "${columnRef}". Available columns: ${headers.join(", ")}` };
  }

  const rows = values.slice(1);
  const nums: number[] = [];
  let skipped = 0;
  for (const row of rows) {
    const raw = row[colIndex];
    if (raw === undefined || raw.trim() === "") continue;
    const n = Number(raw.replace(/[,$%\s]/g, ""));
    if (Number.isFinite(n)) nums.push(n);
    else skipped++;
  }

  const column = headers[colIndex];
  if (operation === "count") {
    return { column, operation, result: nums.length, numericRows: nums.length, skippedNonNumeric: skipped };
  }
  if (nums.length === 0) return { error: `No numeric values found in column "${column}".` };

  const result =
    operation === "sum"
      ? nums.reduce((a, b) => a + b, 0)
      : operation === "avg"
      ? nums.reduce((a, b) => a + b, 0) / nums.length
      : operation === "min"
      ? Math.min(...nums)
      : Math.max(...nums);

  return { column, operation, result, numericRows: nums.length, skippedNonNumeric: skipped };
}

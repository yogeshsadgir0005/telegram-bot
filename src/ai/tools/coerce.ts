// Some models (notably via Groq's strict schema validation) sometimes emit
// numeric tool arguments as strings (e.g. "5" instead of 5), which gets
// rejected server-side before our code ever runs. Declaring these params as
// accepting both types in the JSON schema, then coercing here, avoids that.
export function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

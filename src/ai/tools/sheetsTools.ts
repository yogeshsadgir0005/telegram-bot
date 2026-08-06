import { registerTool } from "./registry";
import { proposeAction } from "../pendingAction.service";
import { listDataSources, readDataSource } from "../../documents/dataSource.service";
import { computeColumnAggregate, AggregateOp } from "../../documents/aggregate";

registerTool({
  name: "list_connected_sheets",
  description: "List the user's data sources: connected Google Sheets AND spreadsheet files they've uploaded directly. Use to find an id before reading/analyzing.",
  parameters: { type: "object", properties: {} },
  execute: async (_args, ctx) => listDataSources(ctx.telegramId),
});

registerTool({
  name: "read_sheet_data",
  description: "Read row/column data from a connected sheet or uploaded file to answer questions or spot trends. Call list_connected_sheets first if the id is unknown.",
  parameters: {
    type: "object",
    properties: {
      sheetId: { type: "string", description: "id from list_connected_sheets (works for both Google Sheets and uploaded files)." },
      range: { type: "string", description: "A1 notation, e.g. 'A1:F100'. Google Sheets only; ignored for uploaded files. Defaults to broad range." },
    },
    required: ["sheetId"],
  },
  execute: async ({ sheetId, range }: { sheetId: string; range?: string }, ctx) => readDataSource(ctx.telegramId, sheetId, range),
});

registerTool({
  name: "compute_column_aggregate",
  description:
    "Compute a real sum/average/count/min/max over a column in a connected sheet or uploaded file — use this instead of eyeballing numbers yourself for any 'total of X' / 'average Y' / 'how many rows' style question.",
  parameters: {
    type: "object",
    properties: {
      sheetId: { type: "string", description: "id from list_connected_sheets." },
      column: { type: "string", description: "Column header name (e.g. 'Revenue') or letter (e.g. 'C')." },
      operation: { type: "string", enum: ["sum", "avg", "count", "min", "max"] },
    },
    required: ["sheetId", "column", "operation"],
  },
  execute: async ({ sheetId, column, operation }: { sheetId: string; column: string; operation: AggregateOp }, ctx) => {
    const data = await readDataSource(ctx.telegramId, sheetId);
    if ("error" in data) return data;
    return computeColumnAggregate(data.values, column, operation);
  },
});

registerTool({
  name: "propose_sheet_write",
  description: "Draft an append/update to a connected Google Sheet for confirmation. Does NOT write. Only works for Google Sheets, not uploaded files.",
  parameters: {
    type: "object",
    properties: {
      sheetId: { type: "string" },
      range: { type: "string", description: "A1 notation — anchor like 'Sheet1!A1' for append, exact range for update." },
      values: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Rows to write." },
      mode: { type: "string", enum: ["append", "update"] },
    },
    required: ["sheetId", "range", "values", "mode"],
  },
  execute: async (args: { sheetId: string; range: string; values: string[][]; mode: "append" | "update" }, ctx) => {
    const preview = args.values.map((row) => row.join(" | ")).join("\n");
    const summary = `📊 ${args.mode === "append" ? "Append to" : "Update"} ${args.range}:\n${preview}`;
    await proposeAction(ctx.telegramId, "sheet_write", summary, args);
    return { proposed: true, summary };
  },
});

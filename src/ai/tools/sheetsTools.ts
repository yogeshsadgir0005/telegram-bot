import { registerTool } from "./registry";
import { listConnectedSheets, readSheetData } from "../../integrations/google/sheets.service";
import { proposeAction } from "../pendingAction.service";

registerTool({
  name: "list_connected_sheets",
  description: "List the Google Sheets the user has connected. Use this to find a sheetId before reading data, or when the user asks what sheets are connected.",
  parameters: { type: "object", properties: {} },
  execute: async (_args, ctx) => listConnectedSheets(ctx.telegramId),
});

registerTool({
  name: "read_sheet_data",
  description:
    "Read raw row/column data from a connected Google Sheet to answer questions, spot trends, or detect anomalies. Call list_connected_sheets first if you don't know the sheetId.",
  parameters: {
    type: "object",
    properties: {
      sheetId: { type: "string", description: "The Google Sheet ID (from list_connected_sheets)." },
      range: { type: "string", description: "A1 notation range, e.g. 'A1:F100'. Defaults to a broad range." },
    },
    required: ["sheetId"],
  },
  execute: async ({ sheetId, range }: { sheetId: string; range?: string }, ctx) =>
    readSheetData(ctx.telegramId, sheetId, range),
});

registerTool({
  name: "propose_sheet_write",
  description:
    "Draft a write (append new rows, or update a range) to a connected Google Sheet for the user to confirm. Does NOT write — writing must always be confirmed by the user first via execute_pending_action.",
  parameters: {
    type: "object",
    properties: {
      sheetId: { type: "string", description: "The Google Sheet ID." },
      range: {
        type: "string",
        description: "A1 notation. For append, a sheet/anchor like 'Sheet1!A1'. For update, the exact target range.",
      },
      values: {
        type: "array",
        items: { type: "array", items: { type: "string" } },
        description: "Rows of cell values to write, e.g. [[\"2026-08-08\", \"Groceries\", \"42.50\"]].",
      },
      mode: { type: "string", enum: ["append", "update"], description: "append adds new rows; update overwrites the given range." },
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

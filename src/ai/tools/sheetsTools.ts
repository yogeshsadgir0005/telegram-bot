import { registerTool } from "./registry";
import { listConnectedSheets, readSheetData } from "../../integrations/google/sheets.service";
import { proposeAction } from "../pendingAction.service";

registerTool({
  name: "list_connected_sheets",
  description: "List the user's connected Google Sheets (to find a sheetId).",
  parameters: { type: "object", properties: {} },
  execute: async (_args, ctx) => listConnectedSheets(ctx.telegramId),
});

registerTool({
  name: "read_sheet_data",
  description: "Read row/column data from a connected sheet to answer questions or spot trends. Call list_connected_sheets first if sheetId unknown.",
  parameters: {
    type: "object",
    properties: {
      sheetId: { type: "string" },
      range: { type: "string", description: "A1 notation, e.g. 'A1:F100'. Defaults to broad range." },
    },
    required: ["sheetId"],
  },
  execute: async ({ sheetId, range }: { sheetId: string; range?: string }, ctx) =>
    readSheetData(ctx.telegramId, sheetId, range),
});

registerTool({
  name: "propose_sheet_write",
  description: "Draft an append/update to a connected sheet for confirmation. Does NOT write.",
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

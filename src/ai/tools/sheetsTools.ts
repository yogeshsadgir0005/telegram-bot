import { registerTool } from "./registry";
import { listConnectedSheets, readSheetData } from "../../integrations/google/sheets.service";

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

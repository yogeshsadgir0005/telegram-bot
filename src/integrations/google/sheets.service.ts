import { google } from "googleapis";
import { getAuthorizedGoogleClient } from "./oauth";
import { Integration } from "../../db/models/Integration";
import { logger } from "../../utils/logger";

export function extractSheetId(urlOrId: string): string | null {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(urlOrId.trim())) return urlOrId.trim();
  return null;
}

export type ConnectSheetResult =
  | { error: string }
  | { error: "not_connected" }
  | { sheetId: string; title: string; url: string };

export async function connectSheet(telegramId: number, urlOrId: string): Promise<ConnectSheetResult> {
  const sheetId = extractSheetId(urlOrId);
  if (!sheetId) return { error: "That doesn't look like a valid Google Sheets link." };

  const client = await getAuthorizedGoogleClient(telegramId);
  if (!client) return { error: "not_connected" };

  try {
    const sheets = google.sheets({ version: "v4", auth: client });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const title = meta.data.properties?.title ?? "Untitled Sheet";
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}`;

    await Integration.findOneAndUpdate(
      { telegramId, "sheets.sheetId": { $ne: sheetId } },
      { $push: { sheets: { sheetId, title, url, addedAt: new Date() } } },
      { upsert: true }
    );

    return { sheetId, title, url };
  } catch (err) {
    logger.warn("connectSheet failed", { telegramId, urlOrId, err: String(err) });
    return { error: "Couldn't access that sheet. Make sure it's shared with your connected Google account." };
  }
}

export async function listConnectedSheets(telegramId: number) {
  const integration = await Integration.findOne({ telegramId });
  return integration?.sheets ?? [];
}

export async function readSheetData(telegramId: number, sheetId: string, range = "A1:Z500") {
  const client = await getAuthorizedGoogleClient(telegramId);
  if (!client) return { error: "not_connected" as const };

  try {
    const sheets = google.sheets({ version: "v4", auth: client });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
    return { values: res.data.values ?? [] };
  } catch (err) {
    logger.warn("readSheetData failed", { telegramId, sheetId, err: String(err) });
    return { error: "Couldn't read data from that sheet." };
  }
}

export interface SheetWriteInput {
  sheetId: string;
  range: string; // A1 notation, e.g. "Sheet1!A2" for append anchor, or exact range for update
  values: string[][]; // rows of cell values
  mode: "append" | "update";
}

export async function writeSheetData(telegramId: number, input: SheetWriteInput): Promise<{ updatedRange?: string } | { error: string }> {
  const client = await getAuthorizedGoogleClient(telegramId);
  if (!client) return { error: "not_connected" };

  try {
    const sheets = google.sheets({ version: "v4", auth: client });
    if (input.mode === "append") {
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId: input.sheetId,
        range: input.range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: input.values },
      });
      return { updatedRange: res.data.updates?.updatedRange ?? undefined };
    }
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId: input.sheetId,
      range: input.range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: input.values },
    });
    return { updatedRange: res.data.updatedRange ?? undefined };
  } catch (err) {
    logger.warn("writeSheetData failed", { telegramId, input, err: String(err) });
    return { error: "Couldn't write to that sheet. Make sure Sheets write access is connected." };
  }
}

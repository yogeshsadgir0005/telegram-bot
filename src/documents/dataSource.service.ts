import { listConnectedSheets, readSheetData } from "../integrations/google/sheets.service";
import { UploadedFile } from "../db/models/UploadedFile";

export interface DataSourceRef {
  type: "google_sheet" | "uploaded_file";
  id: string;
  name: string;
}

// Presents connected Google Sheets and directly-uploaded files as one list
// so the agent doesn't need separate tools/mental models for "a sheet I
// linked" vs "a file the user sent me" — both answer the same kinds of
// questions.
export async function listDataSources(telegramId: number): Promise<DataSourceRef[]> {
  const [sheets, uploads] = await Promise.all([
    listConnectedSheets(telegramId),
    UploadedFile.find({ telegramId }, { name: 1 }).sort({ uploadedAt: -1 }).lean(),
  ]);

  return [
    ...sheets.map((s) => ({ type: "google_sheet" as const, id: s.sheetId, name: s.title })),
    ...uploads.map((u) => ({ type: "uploaded_file" as const, id: String(u._id), name: u.name })),
  ];
}

export async function readDataSource(
  telegramId: number,
  id: string,
  range?: string
): Promise<{ values: string[][] } | { error: string }> {
  try {
    const upload = await UploadedFile.findOne({ _id: id, telegramId }).lean();
    if (upload) return { values: upload.values };
  } catch {
    // Not a valid ObjectId (or DB hiccup) — fall through and treat as a Google Sheet id.
  }

  return readSheetData(telegramId, id, range);
}

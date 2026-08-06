import { Context } from "telegraf";
import axios from "axios";
import { parseSpreadsheetBuffer } from "../../documents/spreadsheetParser";
import { UploadedFile } from "../../db/models/UploadedFile";
import { logger } from "../../utils/logger";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const SUPPORTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export async function handleDocumentUpload(ctx: Context): Promise<void> {
  const message = ctx.message as { document?: { file_id: string; file_name?: string; file_size?: number } } | undefined;
  const doc = message?.document;
  if (!doc) return;

  const name = doc.file_name ?? "upload";
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    await ctx.reply("I can read spreadsheet files (.xlsx, .xls, .csv) — that file type isn't supported yet.");
    return;
  }
  if (doc.file_size && doc.file_size > MAX_FILE_BYTES) {
    await ctx.reply("That file's a bit large for me right now (5MB limit) — try a smaller export or share it as a Google Sheets link instead.");
    return;
  }

  await ctx.sendChatAction("typing");

  try {
    const fileUrl = await ctx.telegram.getFileLink(doc.file_id);
    const res = await axios.get(fileUrl.toString(), { responseType: "arraybuffer", timeout: 15000 });
    const values = await parseSpreadsheetBuffer(Buffer.from(res.data), name);

    if (values.length === 0) {
      await ctx.reply("I couldn't find any data in that file — is it empty?");
      return;
    }

    const telegramId = ctx.from!.id;
    await UploadedFile.create({ telegramId, name, values });

    const headers = values[0].slice(0, 8).join(", ");
    await ctx.reply(
      `Got it — *${name}* (${values.length - 1} rows). Columns: ${headers}${values[0].length > 8 ? ", ..." : ""}\n\nAsk me anything about it, e.g. "what's the total of column ${values[0][0]}" or "summarize the trends in this."`
    );
  } catch (err) {
    logger.warn("handleDocumentUpload failed", { err: String(err) });
    await ctx.reply("Something went wrong reading that file — mind trying again?");
  }
}

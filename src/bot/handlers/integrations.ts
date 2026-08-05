import { Context } from "telegraf";
import { env } from "../../config/env";
import { getGoogleAuthUrl, isGoogleConnected, disconnectGoogle } from "../../integrations/google/oauth";
import { connectSheet, listConnectedSheets } from "../../integrations/google/sheets.service";

export async function handleConnect(ctx: Context, telegramId: number): Promise<void> {
  if (!env.isGoogleConfigured()) {
    await ctx.reply(
      "Google integration isn't configured yet on this deployment (missing GOOGLE_CLIENT_ID/SECRET in .env). Ask the bot owner to set it up."
    );
    return;
  }
  if (await isGoogleConnected(telegramId)) {
    await ctx.reply("Your Google account is already connected. Use /disconnect to unlink it, or /addsheet <link> to add a spreadsheet.");
    return;
  }
  const url = getGoogleAuthUrl(telegramId);
  await ctx.reply(
    `Connect your Google account to unlock inbox summaries and spreadsheet Q&A:\n${url}\n\nThis grants read-only access to Gmail and Sheets — I never send or delete anything on your behalf.`
  );
}

export async function handleDisconnect(ctx: Context, telegramId: number): Promise<void> {
  await disconnectGoogle(telegramId);
  await ctx.reply("Google account disconnected. Gmail and Sheets features are now off.");
}

export async function handleAddSheet(ctx: Context, telegramId: number, urlOrId: string): Promise<void> {
  if (!urlOrId) {
    await ctx.reply("Usage: /addsheet <google sheets link>");
    return;
  }
  const result = await connectSheet(telegramId, urlOrId);
  if ("error" in result) {
    if (result.error === "not_connected") {
      await ctx.reply("You need to connect Google first — run /connect.");
    } else {
      await ctx.reply(result.error);
    }
    return;
  }
  await ctx.reply(`Connected "${result.title}" — ask me things like "summarize trends in ${result.title}".`);
}

export async function handleListSheets(ctx: Context, telegramId: number): Promise<void> {
  const sheets = await listConnectedSheets(telegramId);
  if (!sheets.length) {
    await ctx.reply("No sheets connected yet. Use /addsheet <link> after /connect.");
    return;
  }
  await ctx.reply(sheets.map((s) => `• ${s.title}`).join("\n"));
}

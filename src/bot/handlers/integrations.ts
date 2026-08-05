import { Context } from "telegraf";
import { env } from "../../config/env";
import { getGoogleAuthUrl, isGoogleConnected, hasWriteScopes, disconnectGoogle } from "../../integrations/google/oauth";
import { connectSheet, listConnectedSheets } from "../../integrations/google/sheets.service";

export async function handleConnect(ctx: Context, telegramId: number): Promise<void> {
  if (!env.isGoogleConfigured()) {
    await ctx.reply(
      "Google integration isn't configured yet on this deployment (missing GOOGLE_CLIENT_ID/SECRET in .env). Ask the bot owner to set it up."
    );
    return;
  }

  if (await isGoogleConnected(telegramId)) {
    if (await hasWriteScopes(telegramId)) {
      await ctx.reply("Your Google account is already connected. Use /disconnect to unlink it, or /addsheet <link> to add a spreadsheet.");
      return;
    }
    const url = getGoogleAuthUrl(telegramId);
    await ctx.reply(
      `You connected before I could send emails, create meetings, or write to sheets — reconnect to unlock those:\n${url}`
    );
    return;
  }

  const url = getGoogleAuthUrl(telegramId);
  await ctx.reply(
    `Connect your Google account to unlock inbox intelligence, spreadsheet Q&A, and calendar scheduling:\n${url}\n\n` +
      `I can read your inbox, sheets, and calendar, and I can also send emails, write to sheets, and create meetings on your behalf — but only after you explicitly confirm each one in this chat. I never do any of that silently.`
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

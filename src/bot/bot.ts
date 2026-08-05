import { Telegraf } from "telegraf";
import { env } from "../config/env";
import { getOrCreateUser } from "../db/services/userService";
import { sendWelcome } from "./handlers/onboarding";
import { handleChatMessage } from "./handlers/chat";
import { showSettings } from "./handlers/settings";
import { handleConnect, handleDisconnect, handleAddSheet, handleListSheets } from "./handlers/integrations";
import { findTool } from "../ai/tools";
import { logger } from "../utils/logger";

export const bot = new Telegraf(env.telegramBotToken);

bot.command("start", async (ctx) => {
  const user = await getOrCreateUser(ctx.from);
  if (user.onboardingStep === "done") {
    await ctx.reply("Welcome back! Ask me anything, or /connect to link Gmail, Sheets, or Calendar.");
    return;
  }
  await sendWelcome(ctx, user);
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "Just talk to me naturally — e.g. \"what happened in markets today\", \"schedule a meeting with alex@co.com tomorrow 3pm\", \"remind me to review Q3 numbers Friday 9am\".",
      "",
      "/settings — see and change your preferences (just tell me what to change)",
      "/connect — link Gmail, Sheets & Calendar",
      "/addsheet <link> — connect a spreadsheet",
      "/sheets — list connected spreadsheets",
      "/disconnect — unlink Google account",
    ].join("\n")
  );
});

bot.command("settings", async (ctx) => {
  const user = await getOrCreateUser(ctx.from);
  await showSettings(ctx, user);
});

bot.command("connect", async (ctx) => {
  await handleConnect(ctx, ctx.from.id);
});

bot.command("disconnect", async (ctx) => {
  await handleDisconnect(ctx, ctx.from.id);
});

bot.command("addsheet", async (ctx) => {
  const arg = ctx.message.text.replace(/^\/addsheet(@\w+)?\s*/, "").trim();
  await handleAddSheet(ctx, ctx.from.id, arg);
});

bot.command("sheets", async (ctx) => {
  await handleListSheets(ctx, ctx.from.id);
});

// One-tap shortcut for the pending-action confirm gate — equivalent to the
// user typing "yes"/"cancel", just faster. Calls the same tools the agent
// itself uses, so behavior is identical either way.
bot.action("pending:confirm", async (ctx) => {
  await ctx.answerCbQuery();
  const tool = findTool("execute_pending_action");
  if (!tool) return;
  const result: any = await tool.execute({}, { telegramId: ctx.from!.id });
  await ctx.reply(result?.error ? result.error : "Done ✅");
});

bot.action("pending:cancel", async (ctx) => {
  await ctx.answerCbQuery();
  const tool = findTool("cancel_pending_action");
  if (!tool) return;
  await tool.execute({}, { telegramId: ctx.from!.id });
  await ctx.reply("Cancelled.");
});

bot.on("text", async (ctx) => {
  const user = await getOrCreateUser(ctx.from);
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) return;

  if (user.onboardingStep !== "done") {
    // New user chatting without ever typing /start — greet them, then still
    // respond to what they actually said instead of discarding it.
    await sendWelcome(ctx, user);
  }

  await handleChatMessage(ctx, user, text);
});

bot.catch((err, ctx) => {
  logger.error("Unhandled bot error", { updateType: ctx.updateType, err: String(err) });
});

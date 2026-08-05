import { Telegraf } from "telegraf";
import { env } from "../config/env";
import { getOrCreateUser } from "../db/services/userService";
import {
  beginOnboarding,
  handleOnboardingText,
  handleVerticalToggle,
  handleVerticalContinue,
  handleScheduleChoice,
  skipOnboarding,
} from "./handlers/onboarding";
import { handleChatMessage } from "./handlers/chat";
import { showSettings, handleSettingsToggle } from "./handlers/settings";
import { handleConnect, handleDisconnect, handleAddSheet, handleListSheets } from "./handlers/integrations";
import { logger } from "../utils/logger";

export const bot = new Telegraf(env.telegramBotToken);

bot.command("start", async (ctx) => {
  const user = await getOrCreateUser(ctx.from);
  if (user.onboardingStep === "done") {
    await ctx.reply("Welcome back! Ask me anything, or run /settings to adjust preferences.");
    return;
  }
  await beginOnboarding(ctx, user);
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "Just talk to me naturally — e.g. \"what happened in markets today\" or \"how's NVDA doing\".",
      "",
      "/settings — manage briefing preferences",
      "/connect — link Gmail & Google Sheets",
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

bot.command("skip", async (ctx) => {
  const user = await getOrCreateUser(ctx.from);
  if (user.onboardingStep !== "done") await skipOnboarding(ctx, user);
});

bot.action(/^ob:vertical:(.+)$/, async (ctx) => {
  const value = ctx.match[1];
  const user = await getOrCreateUser(ctx.from);
  await ctx.answerCbQuery();
  if (value === "continue") await handleVerticalContinue(ctx, user);
  else await handleVerticalToggle(ctx, user, value);
});

bot.action(/^ob:sched:(.+)$/, async (ctx) => {
  const value = ctx.match[1];
  const user = await getOrCreateUser(ctx.from);
  await ctx.answerCbQuery();
  await handleScheduleChoice(ctx, user, value);
});

bot.action("ob:skip", async (ctx) => {
  const user = await getOrCreateUser(ctx.from);
  await ctx.answerCbQuery();
  await skipOnboarding(ctx, user);
});

bot.action(/^settings:toggle:(.+)$/, async (ctx) => {
  const key = ctx.match[1];
  const user = await getOrCreateUser(ctx.from);
  await ctx.answerCbQuery();
  await handleSettingsToggle(ctx, user, key);
});

bot.action("settings:connect_google", async (ctx) => {
  await ctx.answerCbQuery();
  await handleConnect(ctx, ctx.from.id);
});

bot.on("text", async (ctx) => {
  const user = await getOrCreateUser(ctx.from);
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) return;

  if (user.onboardingStep !== "done") {
    await handleOnboardingText(ctx, user, text);
    return;
  }

  await handleChatMessage(ctx, user, text);
});

bot.catch((err, ctx) => {
  logger.error("Unhandled bot error", { updateType: ctx.updateType, err: String(err) });
});

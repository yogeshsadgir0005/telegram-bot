import { Context } from "telegraf";
import { IUser } from "../../db/models/User";
import { settingsKeyboard } from "../keyboards";

type ToggleKey = "morningBriefing" | "eveningSummary" | "breakingUpdates" | "weeklyDigest";

export async function showSettings(ctx: Context, user: IUser): Promise<void> {
  await ctx.reply(
    "Your preferences — tap to toggle:",
    settingsKeyboard(user as unknown as Parameters<typeof settingsKeyboard>[0])
  );
}

export async function handleSettingsToggle(ctx: Context, user: IUser, key: string): Promise<void> {
  if (!isToggleKey(key)) return;
  user.notifications[key].enabled = !user.notifications[key].enabled;
  await user.save();
  await ctx.editMessageReplyMarkup(
    settingsKeyboard(user as unknown as Parameters<typeof settingsKeyboard>[0]).reply_markup
  );
}

function isToggleKey(key: string): key is ToggleKey {
  return ["morningBriefing", "eveningSummary", "breakingUpdates", "weeklyDigest"].includes(key);
}

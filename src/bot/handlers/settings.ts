import { Context } from "telegraf";
import { IUser } from "../../db/models/User";

// Plain-text summary, not a button grid — changes happen by just telling
// the assistant what to change (handled by update_notification_preference
// via normal chat), matching the "conversation, not options" design goal.
export async function showSettings(ctx: Context, user: IUser): Promise<void> {
  const n = user.notifications;
  const lines = [
    "Here's what you've got set up:",
    `• Morning Briefing: ${n.morningBriefing.enabled ? `on, ${n.morningBriefing.time}` : "off"}`,
    `• Evening Summary: ${n.eveningSummary.enabled ? `on, ${n.eveningSummary.time}` : "off"}`,
    `• Breaking Updates: ${n.breakingUpdates.enabled ? "on" : "off"}`,
    `• Weekly Digest: ${n.weeklyDigest.enabled ? `on, ${n.weeklyDigest.time}` : "off"}`,
    user.role ? `• Role: ${user.role}` : undefined,
    user.topics.length ? `• Tracking: ${user.topics.join(", ")}` : undefined,
    "",
    "Just tell me what to change — e.g. \"turn off evening summary\" or \"move my morning briefing to 7am\". /connect to link Gmail, Sheets, or Calendar.",
  ].filter(Boolean);
  await ctx.reply(lines.join("\n"));
}

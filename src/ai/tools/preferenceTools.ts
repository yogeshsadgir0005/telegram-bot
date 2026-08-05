import { registerTool } from "./registry";
import { User } from "../../db/models/User";
import { toNumber } from "./coerce";

const VALID_KEYS = ["morningBriefing", "eveningSummary", "breakingUpdates", "weeklyDigest"] as const;
type PreferenceKey = (typeof VALID_KEYS)[number];

registerTool({
  name: "update_notification_preference",
  description:
    "Turn a recurring update on/off or change its time, based on what the user says in conversation (e.g. 'turn off evening summary', 'move my morning briefing to 7am'). Valid keys: morningBriefing, eveningSummary, breakingUpdates, weeklyDigest.",
  parameters: {
    type: "object",
    properties: {
      key: { type: "string", enum: VALID_KEYS as unknown as string[] },
      enabled: { type: "boolean", description: "true to turn on, false to turn off." },
      time: { type: "string", description: "24h HH:mm, e.g. '07:00'. Not applicable to breakingUpdates." },
      dayOfWeek: { type: ["number", "string"], description: "0=Sunday..6=Saturday. Only applies to weeklyDigest." },
    },
    required: ["key"],
  },
  execute: async (args: { key: string; enabled?: boolean; time?: string; dayOfWeek?: number | string }, ctx) => {
    if (!VALID_KEYS.includes(args.key as PreferenceKey)) return { error: `Unknown preference key: ${args.key}` };

    const set: Record<string, unknown> = {};
    if (args.enabled !== undefined) set[`notifications.${args.key}.enabled`] = args.enabled;
    if (args.time && args.key !== "breakingUpdates") set[`notifications.${args.key}.time`] = args.time;
    const dayOfWeek = toNumber(args.dayOfWeek);
    if (dayOfWeek !== undefined && args.key === "weeklyDigest") set[`notifications.weeklyDigest.dayOfWeek`] = dayOfWeek;

    if (Object.keys(set).length === 0) return { updated: false };
    await User.updateOne({ telegramId: ctx.telegramId }, { $set: set });
    return { updated: true };
  },
});

registerTool({
  name: "get_current_preferences",
  description: "Get the user's current notification preferences and profile so you can describe them in conversation (e.g. when asked 'what are my settings').",
  parameters: { type: "object", properties: {} },
  execute: async (_args, ctx) => {
    const user = await User.findOne({ telegramId: ctx.telegramId });
    if (!user) return { error: "not_found" };
    return {
      role: user.role,
      verticals: user.verticals,
      topics: user.topics,
      companiesFollowed: user.companiesFollowed,
      timezone: user.timezone,
      notifications: user.notifications,
    };
  },
});

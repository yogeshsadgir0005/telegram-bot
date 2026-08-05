import { Markup } from "telegraf";

export const ALL_VERTICALS = [
  "technology",
  "investing",
  "startup ecosystem",
  "business",
  "productivity",
  "healthcare",
  "legal",
  "education",
  "research",
] as const;

export function verticalsKeyboard(selected: string[]) {
  const rows = ALL_VERTICALS.map((v) => [
    Markup.button.callback(`${selected.includes(v) ? "✅ " : ""}${cap(v)}`, `ob:vertical:${v}`),
  ]);
  rows.push([Markup.button.callback("Continue ➜", "ob:vertical:continue")]);
  return Markup.inlineKeyboard(rows);
}

export function scheduleKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("7:00 AM", "ob:sched:07:00"),
      Markup.button.callback("8:00 AM", "ob:sched:08:00"),
      Markup.button.callback("9:00 AM", "ob:sched:09:00"),
    ],
    [Markup.button.callback("Skip for now", "ob:sched:skip")],
  ]);
}

export function skipKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("Skip ➜", "ob:skip")]]);
}

export function settingsKeyboard(user: { notifications: { morningBriefing: { enabled: boolean }; eveningSummary: { enabled: boolean }; breakingUpdates: { enabled: boolean }; weeklyDigest: { enabled: boolean } } }) {
  const n = user.notifications;
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${n.morningBriefing.enabled ? "🟢" : "⚪️"} Morning Briefing`, "settings:toggle:morningBriefing")],
    [Markup.button.callback(`${n.eveningSummary.enabled ? "🟢" : "⚪️"} Evening Summary`, "settings:toggle:eveningSummary")],
    [Markup.button.callback(`${n.breakingUpdates.enabled ? "🟢" : "⚪️"} Breaking Updates`, "settings:toggle:breakingUpdates")],
    [Markup.button.callback(`${n.weeklyDigest.enabled ? "🟢" : "⚪️"} Weekly Digest`, "settings:toggle:weeklyDigest")],
    [Markup.button.callback("Connect Google (Gmail + Sheets)", "settings:connect_google")],
  ]);
}

function cap(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

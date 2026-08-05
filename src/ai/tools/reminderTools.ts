import { registerTool } from "./registry";
import { Reminder } from "../../db/models/Reminder";
import { createEvent } from "../../integrations/google/calendar.service";
import { isGoogleConnected } from "../../integrations/google/oauth";

// Reminders only affect the user's own calendar/chat (no other person is
// notified), so unlike email/meeting-invite/sheet-write, this executes
// directly without a confirm step — requiring "yes" on every reminder would
// fight the goal of feeling like a fast, natural assistant rather than a form.
registerTool({
  name: "create_reminder",
  description: "Set a reminder. Resolve natural-language time to ISO 8601 first. Also adds a personal Calendar event if connected, unless Telegram-only requested.",
  parameters: {
    type: "object",
    properties: {
      message: { type: "string" },
      dueAtIso: { type: "string", description: "ISO 8601." },
      alsoAddToCalendar: { type: "boolean", description: "Default true if Google connected." },
    },
    required: ["message", "dueAtIso"],
  },
  execute: async ({ message, dueAtIso, alsoAddToCalendar }: { message: string; dueAtIso: string; alsoAddToCalendar?: boolean }, ctx) => {
    const dueAt = new Date(dueAtIso);
    if (Number.isNaN(dueAt.getTime())) return { error: "Invalid date/time." };

    let calendarEventId: string | undefined;
    const wantsCalendar = alsoAddToCalendar !== false && (await isGoogleConnected(ctx.telegramId));
    if (wantsCalendar) {
      const end = new Date(dueAt.getTime() + 30 * 60 * 1000);
      const result = await createEvent(ctx.telegramId, {
        title: `Reminder: ${message}`,
        startIso: dueAt.toISOString(),
        endIso: end.toISOString(),
        attendeeEmails: [],
      });
      if ("id" in result) calendarEventId = result.id;
    }

    await Reminder.create({ telegramId: ctx.telegramId, message, dueAt, calendarEventId });
    return { created: true, dueAt: dueAt.toISOString(), addedToCalendar: Boolean(calendarEventId) };
  },
});

registerTool({
  name: "list_reminders",
  description: "List the user's upcoming reminders.",
  parameters: { type: "object", properties: {} },
  execute: async (_args, ctx) => {
    const reminders = await Reminder.find({ telegramId: ctx.telegramId, sent: false, dueAt: { $gte: new Date() } })
      .sort({ dueAt: 1 })
      .lean();
    return { reminders: reminders.map((r) => ({ message: r.message, dueAt: r.dueAt })) };
  },
});

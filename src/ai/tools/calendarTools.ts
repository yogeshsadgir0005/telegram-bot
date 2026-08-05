import { registerTool } from "./registry";
import { listUpcomingEvents } from "../../integrations/google/calendar.service";
import { proposeAction } from "../pendingAction.service";
import { toNumber } from "./coerce";

registerTool({
  name: "get_upcoming_events",
  description: "User's upcoming Calendar events (title, time, attendees). Read-only, safe to call directly.",
  parameters: {
    type: "object",
    properties: { maxResults: { type: ["number", "string"], description: "Max events, default 10." } },
  },
  execute: async ({ maxResults }: { maxResults?: number | string }, ctx) => {
    const events = await listUpcomingEvents(ctx.telegramId, toNumber(maxResults) ?? 10);
    if (events === null) return { error: "not_connected" };
    return { events };
  },
});

registerTool({
  name: "propose_calendar_event",
  description: "Draft a meeting for confirmation. Does NOT create it (creating emails real invites). Resolve natural-language date/time to ISO 8601 yourself first.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      startIso: { type: "string", description: "ISO 8601, e.g. 2026-08-08T21:00:00." },
      endIso: { type: "string", description: "ISO 8601, default 30-60min after start." },
      attendeeEmails: { type: "array", items: { type: "string" } },
      description: { type: "string" },
      timezone: { type: "string", description: "IANA tz, e.g. Asia/Kolkata." },
    },
    required: ["title", "startIso", "endIso"],
  },
  execute: async (
    args: { title: string; startIso: string; endIso: string; attendeeEmails?: string[]; description?: string; timezone?: string },
    ctx
  ) => {
    const attendees = args.attendeeEmails ?? [];
    const summary = `📅 *${args.title}*\n${args.startIso} → ${args.endIso}${
      attendees.length ? `\nInvitees: ${attendees.join(", ")}` : ""
    }`;
    await proposeAction(ctx.telegramId, "calendar_event", summary, {
      title: args.title,
      startIso: args.startIso,
      endIso: args.endIso,
      attendeeEmails: attendees,
      description: args.description,
      timezone: args.timezone,
    });
    return { proposed: true, summary };
  },
});

import { registerTool } from "./registry";
import { listUpcomingEvents } from "../../integrations/google/calendar.service";
import { proposeAction } from "../pendingAction.service";
import { toNumber } from "./coerce";

registerTool({
  name: "get_upcoming_events",
  description: "Get the user's upcoming Google Calendar events (title, time, attendees). Read-only, safe to call directly.",
  parameters: {
    type: "object",
    properties: {
      maxResults: { type: ["number", "string"], description: "Max events to return, default 10." },
    },
  },
  execute: async ({ maxResults }: { maxResults?: number | string }, ctx) => {
    const events = await listUpcomingEvents(ctx.telegramId, toNumber(maxResults) ?? 10);
    if (events === null) return { error: "not_connected" };
    return { events };
  },
});

registerTool({
  name: "propose_calendar_event",
  description:
    "Draft a calendar meeting for the user to confirm. Does NOT create the event — creating it sends real invite emails to attendees, so it must always be confirmed by the user first via execute_pending_action. Resolve any natural-language date/time (e.g. 'next Tuesday 3pm') into ISO 8601 yourself using today's date before calling this.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Meeting title." },
      startIso: { type: "string", description: "Start time, ISO 8601, e.g. 2026-08-08T21:00:00." },
      endIso: { type: "string", description: "End time, ISO 8601. Default to 30-60 min after start if not specified." },
      attendeeEmails: { type: "array", items: { type: "string" }, description: "Email addresses of people to invite." },
      description: { type: "string", description: "Optional meeting description/agenda." },
      timezone: { type: "string", description: "IANA timezone, e.g. Asia/Kolkata. Default UTC if unknown." },
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

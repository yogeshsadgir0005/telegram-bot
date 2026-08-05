import { google } from "googleapis";
import { getAuthorizedGoogleClient } from "./oauth";
import { logger } from "../../utils/logger";

export interface CalendarEventSummary {
  id: string;
  title: string;
  start?: string;
  end?: string;
  attendees: string[];
  location?: string;
}

export interface CreateEventInput {
  title: string;
  startIso: string; // ISO 8601, e.g. 2026-08-08T21:00:00
  endIso: string;
  attendeeEmails: string[];
  description?: string;
  timezone?: string;
}

export async function listUpcomingEvents(telegramId: number, maxResults = 10): Promise<CalendarEventSummary[] | null> {
  const client = await getAuthorizedGoogleClient(telegramId);
  if (!client) return null;

  try {
    const calendar = google.calendar({ version: "v3", auth: client });
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });

    return (res.data.items ?? []).map((e) => ({
      id: e.id ?? "",
      title: e.summary ?? "(no title)",
      start: e.start?.dateTime ?? e.start?.date ?? undefined,
      end: e.end?.dateTime ?? e.end?.date ?? undefined,
      attendees: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
      location: e.location ?? undefined,
    }));
  } catch (err) {
    logger.warn("listUpcomingEvents failed", { telegramId, err: String(err) });
    return null;
  }
}

export async function createEvent(telegramId: number, input: CreateEventInput): Promise<{ id: string; htmlLink?: string } | { error: string }> {
  const client = await getAuthorizedGoogleClient(telegramId);
  if (!client) return { error: "not_connected" };

  try {
    const calendar = google.calendar({ version: "v3", auth: client });
    const res = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all", // actually email invitees — this is the real side effect being confirmed upstream
      requestBody: {
        summary: input.title,
        description: input.description,
        start: { dateTime: input.startIso, timeZone: input.timezone ?? "UTC" },
        end: { dateTime: input.endIso, timeZone: input.timezone ?? "UTC" },
        attendees: input.attendeeEmails.map((email) => ({ email })),
      },
    });
    return { id: res.data.id ?? "", htmlLink: res.data.htmlLink ?? undefined };
  } catch (err) {
    logger.warn("createEvent failed", { telegramId, err: String(err) });
    return { error: "Couldn't create the calendar event. Make sure Calendar access is connected." };
  }
}

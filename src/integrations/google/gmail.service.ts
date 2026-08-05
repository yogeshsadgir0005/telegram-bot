import { google } from "googleapis";
import { getAuthorizedGoogleClient } from "./oauth";
import { logger } from "../../utils/logger";

export interface EmailSummaryItem {
  from: string;
  subject: string;
  snippet: string;
  date?: string;
  unread: boolean;
}

// Pulls recent inbox mail, excluding promotions/social noise, and hands raw
// data to the AI agent to decide what's actually important — we don't
// hardcode "important" here beyond filtering out obvious clutter categories.
export async function getRecentInboxItems(telegramId: number, maxResults = 20): Promise<EmailSummaryItem[] | null> {
  const client = await getAuthorizedGoogleClient(telegramId);
  if (!client) return null;

  try {
    const gmail = google.gmail({ version: "v1", auth: client });
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: "in:inbox -category:promotions -category:social",
    });

    const messages = list.data.messages ?? [];
    const items: EmailSummaryItem[] = [];

    for (const msg of messages) {
      if (!msg.id) continue;
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const headers = detail.data.payload?.headers ?? [];
      const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";
      items.push({
        from: get("From"),
        subject: get("Subject"),
        snippet: detail.data.snippet ?? "",
        date: get("Date"),
        unread: (detail.data.labelIds ?? []).includes("UNREAD"),
      });
    }

    return items;
  } catch (err) {
    logger.warn("getRecentInboxItems failed", { telegramId, err: String(err) });
    return null;
  }
}

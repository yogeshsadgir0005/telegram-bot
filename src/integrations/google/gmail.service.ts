import { google } from "googleapis";
import { getAuthorizedGoogleClient } from "./oauth";
import { logger } from "../../utils/logger";

export interface EmailSummaryItem {
  id: string;
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
        id: msg.id,
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

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  threadId?: string; // set when replying within an existing thread
  inReplyToMessageId?: string; // Gmail message id being replied to, for headers
}

function toBase64Url(input: string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendEmail(telegramId: number, input: SendEmailInput): Promise<{ id: string } | { error: string }> {
  const client = await getAuthorizedGoogleClient(telegramId);
  if (!client) return { error: "not_connected" };

  try {
    const gmail = google.gmail({ version: "v1", auth: client });

    let inReplyToHeader = "";
    if (input.inReplyToMessageId) {
      const original = await gmail.users.messages.get({
        userId: "me",
        id: input.inReplyToMessageId,
        format: "metadata",
        metadataHeaders: ["Message-Id"],
      });
      const messageIdHeader = original.data.payload?.headers?.find((h) => h.name === "Message-Id")?.value;
      if (messageIdHeader) inReplyToHeader = `In-Reply-To: ${messageIdHeader}\r\nReferences: ${messageIdHeader}\r\n`;
    }

    const raw = [`To: ${input.to}`, `Subject: ${input.subject}`, inReplyToHeader.trim(), "Content-Type: text/plain; charset=utf-8", "", input.body]
      .filter(Boolean)
      .join("\r\n");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: toBase64Url(raw), threadId: input.threadId },
    });

    return { id: res.data.id ?? "" };
  } catch (err) {
    logger.warn("sendEmail failed", { telegramId, err: String(err) });
    return { error: "Couldn't send that email. Make sure Gmail send access is connected." };
  }
}

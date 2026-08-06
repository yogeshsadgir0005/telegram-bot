import { registerTool } from "./registry";
import { getRecentInboxItems, searchEmails, getEmailBody } from "../../integrations/google/gmail.service";
import { proposeAction } from "../pendingAction.service";
import { toNumber } from "./coerce";

registerTool({
  name: "get_inbox_summary",
  description: "Recent inbox emails (sender, subject, snippet) to identify what's important. Needs Gmail connected — if not_connected, tell user to run /connect.",
  parameters: {
    type: "object",
    properties: { maxResults: { type: ["number", "string"], description: "Max emails, default 20." } },
  },
  execute: async ({ maxResults }: { maxResults?: number | string }, ctx) => {
    const items = await getRecentInboxItems(ctx.telegramId, toNumber(maxResults) ?? 20);
    if (items === null) return { error: "not_connected" };
    return { items };
  },
});

registerTool({
  name: "search_emails",
  description:
    "Search the user's Gmail for specific emails using Gmail's search syntax (from:, subject:, after:YYYY/MM/DD, has:attachment, is:unread, etc). Use when the user asks about a specific sender/topic rather than 'what's in my inbox'.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Gmail search query, e.g. 'from:boss@co.com subject:budget'." },
      maxResults: { type: ["number", "string"], description: "Max results, default 15." },
    },
    required: ["query"],
  },
  execute: async ({ query, maxResults }: { query: string; maxResults?: number | string }, ctx) => {
    const items = await searchEmails(ctx.telegramId, query, toNumber(maxResults) ?? 15);
    if (items === null) return { error: "not_connected" };
    return { items };
  },
});

registerTool({
  name: "read_email",
  description: "Read the FULL body of a specific email (not just the snippet) to answer detailed questions about what it says. Get the id from get_inbox_summary or search_emails first.",
  parameters: {
    type: "object",
    properties: { messageId: { type: "string" } },
    required: ["messageId"],
  },
  execute: async ({ messageId }: { messageId: string }, ctx) => getEmailBody(ctx.telegramId, messageId),
});

registerTool({
  name: "propose_email_send",
  description: "Draft an email/reply for confirmation. Does NOT send. Pass replyToMessageId (from get_inbox_summary) to reply to an existing email.",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient." },
      subject: { type: "string" },
      body: { type: "string", description: "Plain text body." },
      replyToMessageId: { type: "string" },
    },
    required: ["to", "subject", "body"],
  },
  execute: async (args: { to: string; subject: string; body: string; replyToMessageId?: string }, ctx) => {
    const summary = `✉️ To: ${args.to}\nSubject: ${args.subject}\n\n${args.body}`;
    await proposeAction(ctx.telegramId, "email_send", summary, {
      to: args.to,
      subject: args.subject,
      body: args.body,
      inReplyToMessageId: args.replyToMessageId,
    });
    return { proposed: true, summary };
  },
});

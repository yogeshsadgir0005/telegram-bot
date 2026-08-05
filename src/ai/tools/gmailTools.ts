import { registerTool } from "./registry";
import { getRecentInboxItems } from "../../integrations/google/gmail.service";
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

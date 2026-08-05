import { registerTool } from "./registry";
import { getRecentInboxItems } from "../../integrations/google/gmail.service";
import { proposeAction } from "../pendingAction.service";

registerTool({
  name: "get_inbox_summary",
  description:
    "Get the user's recent inbox emails (sender, subject, snippet) so you can identify what's actually important and summarize it. Only works if the user has connected Gmail; if it returns not_connected, tell the user to run /connect to link Gmail.",
  parameters: {
    type: "object",
    properties: {
      maxResults: { type: "number", description: "Max number of recent emails to fetch, default 20." },
    },
  },
  execute: async ({ maxResults }: { maxResults?: number }, ctx) => {
    const items = await getRecentInboxItems(ctx.telegramId, maxResults ?? 20);
    if (items === null) return { error: "not_connected" };
    return { items };
  },
});

registerTool({
  name: "propose_email_send",
  description:
    "Draft a new email or reply for the user to confirm. Does NOT send it — sending must always be confirmed by the user first via execute_pending_action. To reply to an existing email, pass its id (from get_inbox_summary) as replyToMessageId.",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address." },
      subject: { type: "string" },
      body: { type: "string", description: "Plain text email body." },
      replyToMessageId: { type: "string", description: "Optional: id of the email being replied to." },
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

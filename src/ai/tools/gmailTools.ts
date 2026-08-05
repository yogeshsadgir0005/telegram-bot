import { registerTool } from "./registry";
import { getRecentInboxItems } from "../../integrations/google/gmail.service";

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

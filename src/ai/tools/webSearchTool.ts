import { registerTool } from "./registry";
import { webSearch } from "./webSearch";

registerTool({
  name: "web_search",
  description:
    "Search the live web for information not covered by the finance news or quote tools (e.g. general company info, regulatory filings, official announcements, definitions). Only use when local tools are insufficient. Always cite the source URL in your response.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query." },
    },
    required: ["query"],
  },
  execute: async ({ query }: { query: string }) => webSearch(query),
});

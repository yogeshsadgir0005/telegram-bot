import { registerTool } from "./registry";
import { webSearch } from "./webSearch";

registerTool({
  name: "web_search",
  description: "Live web search for info not covered by finance/news tools. Use only when those are insufficient; cite the source URL.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query." },
    },
    required: ["query"],
  },
  execute: async ({ query }: { query: string }) => webSearch(query),
});

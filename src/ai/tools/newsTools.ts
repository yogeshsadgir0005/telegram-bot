import { registerTool } from "./registry";
import { fetchFinanceNews, fetchNewsForQuery } from "../../finance/news.service";
import { toNumber } from "./coerce";

registerTool({
  name: "get_finance_news",
  description: "Latest general finance/market headlines (Yahoo, MarketWatch, CNBC, Investing.com). For broad 'what happened today' questions.",
  parameters: {
    type: "object",
    properties: { limit: { type: ["number", "string"], description: "Max headlines, default 15." } },
  },
  execute: async ({ limit }: { limit?: number | string }) => fetchFinanceNews(toNumber(limit) ?? 15),
});

registerTool({
  name: "search_finance_news",
  description: "Search recent finance news for a specific company, ticker, or topic.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Company, ticker, or topic." } },
    required: ["query"],
  },
  execute: async ({ query }: { query: string }) => fetchNewsForQuery(query),
});

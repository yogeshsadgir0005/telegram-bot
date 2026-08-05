import { registerTool } from "./registry";
import { fetchFinanceNews, fetchNewsForQuery } from "../../finance/news.service";

registerTool({
  name: "get_finance_news",
  description:
    "Get the latest general finance/market news headlines from trusted sources (Yahoo Finance, MarketWatch, CNBC, Investing.com). Use for broad 'what happened today' style questions.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max number of headlines to return, default 15." },
    },
  },
  execute: async ({ limit }: { limit?: number }) => fetchFinanceNews(limit ?? 15),
});

registerTool({
  name: "search_finance_news",
  description:
    "Search recent finance/market news for a specific company, ticker, or topic. Use when the user asks about news related to a specific company or subject.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Company name, ticker, or topic to search news for." },
    },
    required: ["query"],
  },
  execute: async ({ query }: { query: string }) => fetchNewsForQuery(query),
});

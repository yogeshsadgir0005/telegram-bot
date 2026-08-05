import { registerTool } from "./registry";
import { getQuote, getQuotes, getMarketSnapshot, searchSymbol } from "../../finance/marketData.service";

registerTool({
  name: "get_stock_quote",
  description:
    "Get the latest price, daily change, and market cap for one or more stock/ETF/index ticker symbols. Use this whenever the user asks about a specific company's stock price or performance. If the result has delayed:true, the data is the last end-of-day close (real-time feed was unavailable) — mention that to the user instead of implying it's live.",
  parameters: {
    type: "object",
    properties: {
      symbols: {
        type: "array",
        items: { type: "string" },
        description: "Ticker symbols, e.g. ['AAPL', 'MSFT']. Use Yahoo Finance style symbols.",
      },
    },
    required: ["symbols"],
  },
  execute: async ({ symbols }: { symbols: string[] }) => {
    if (symbols.length === 1) {
      const q = await getQuote(symbols[0]);
      return q ?? { error: `No data found for ${symbols[0]}` };
    }
    return getQuotes(symbols);
  },
});

registerTool({
  name: "get_market_snapshot",
  description:
    "Get the current level and daily change of the major US indices (S&P 500, Dow Jones, Nasdaq). Use this for 'how is the market doing' style questions.",
  parameters: { type: "object", properties: {} },
  execute: async () => getMarketSnapshot(),
});

registerTool({
  name: "search_ticker_symbol",
  description:
    "Resolve a company name to its stock ticker symbol when the user mentions a company but not its ticker (e.g. 'Nvidia' -> 'NVDA').",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Company name to search for." },
    },
    required: ["query"],
  },
  execute: async ({ query }: { query: string }) => searchSymbol(query),
});

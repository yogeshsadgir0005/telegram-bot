import { registerTool } from "./registry";
import { getQuote, getQuotes, getMarketSnapshot, searchSymbol, getStockTrend, compareStockTrends } from "../../finance/marketData.service";
import { toNumber } from "./coerce";

registerTool({
  name: "get_stock_quote",
  description:
    "Get the latest price, daily change, market cap, and fundamentals (P/E ratio, 52-week high/low, dividend yield, EPS) for one or more stock/ETF/index ticker symbols. Use this for 'what's the price/valuation of X' questions. For 'how has X been doing' / trend / performance questions, use get_stock_trend instead. If the result has delayed:true, the data is the last end-of-day close (real-time feed was unavailable) — mention that to the user instead of implying it's live.",
  parameters: {
    type: "object",
    properties: {
      symbols: {
        type: "array",
        items: { type: "string" },
        description:
          "Ticker symbols, e.g. ['AAPL', 'MSFT']. Common index names also work directly without searching: NIFTY, SENSEX, BANKNIFTY, S&P 500, DOW, NASDAQ, FTSE, NIKKEI, DAX, HANG SENG.",
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
  name: "get_stock_trend",
  description:
    "Analyze a stock's price trend over a period: percent change, direction, and high/low. This is the core tool for stock analysis — use it whenever the user asks how a stock has been doing, its trend, momentum, or performance over time (not just today's price).",
  parameters: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Ticker symbol, e.g. 'AAPL', or a common index name like NIFTY/SENSEX/S&P 500 — no need to search first." },
      days: { type: ["number", "string"], description: "Lookback period in trading days, default 90 (~3 months). Use ~20 for 1 month, ~250 for 1 year." },
    },
    required: ["symbol"],
  },
  execute: async ({ symbol, days }: { symbol: string; days?: number | string }) => {
    const trend = await getStockTrend(symbol, toNumber(days) ?? 90);
    return trend ?? { error: `No trend data found for ${symbol}` };
  },
});

registerTool({
  name: "compare_stock_trends",
  description: "Compare the price trend/performance of multiple stocks over the same period. Use for 'compare X and Y' or 'which did better' style questions.",
  parameters: {
    type: "object",
    properties: {
      symbols: { type: "array", items: { type: "string" }, description: "Ticker symbols to compare, e.g. ['AAPL','MSFT']." },
      days: { type: ["number", "string"], description: "Lookback period in trading days, default 90." },
    },
    required: ["symbols"],
  },
  execute: async ({ symbols, days }: { symbols: string[]; days?: number | string }) => compareStockTrends(symbols, toNumber(days) ?? 90),
});

registerTool({
  name: "search_ticker_symbol",
  description:
    "Resolve a company name to its stock ticker symbol when the user mentions a company but not its ticker (e.g. 'Nvidia' -> 'NVDA'). Not needed for common indices (NIFTY, SENSEX, S&P 500, etc.) — pass those names directly to get_stock_quote/get_stock_trend instead.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Company name to search for." },
    },
    required: ["query"],
  },
  execute: async ({ query }: { query: string }) => searchSymbol(query),
});

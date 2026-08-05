import { registerTool } from "./registry";
import { getQuote, getQuotes, getMarketSnapshot, searchSymbol, getStockTrend, compareStockTrends } from "../../finance/marketData.service";
import { toNumber } from "./coerce";

registerTool({
  name: "get_stock_quote",
  description: "Price, change, market cap, P/E, 52-week range for one or more tickers. For trend/performance questions use get_stock_trend instead.",
  parameters: {
    type: "object",
    properties: {
      symbols: { type: "array", items: { type: "string" }, description: "Tickers, e.g. ['AAPL']. Index names (NIFTY, SENSEX, S&P 500, DOW, NASDAQ, FTSE, NIKKEI, DAX) work directly." },
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
  description: "S&P 500, Dow, Nasdaq levels and change — for 'how's the market doing' questions.",
  parameters: { type: "object", properties: {} },
  execute: async () => getMarketSnapshot(),
});

registerTool({
  name: "get_stock_trend",
  description: "Core stock-analysis tool: percent change, direction, high/low over a period. Use for 'how's X doing' / trend / performance questions.",
  parameters: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Ticker or index name (NIFTY, SENSEX, S&P 500, etc.) — no search needed." },
      days: { type: ["number", "string"], description: "Lookback trading days, default 90. ~20=1mo, ~250=1yr." },
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
  description: "Compare price trend/performance of multiple stocks over the same period.",
  parameters: {
    type: "object",
    properties: {
      symbols: { type: "array", items: { type: "string" }, description: "Tickers to compare." },
      days: { type: ["number", "string"], description: "Lookback trading days, default 90." },
    },
    required: ["symbols"],
  },
  execute: async ({ symbols, days }: { symbols: string[]; days?: number | string }) => compareStockTrends(symbols, toNumber(days) ?? 90),
});

registerTool({
  name: "search_ticker_symbol",
  description: "Resolve a company name to its ticker (e.g. 'Nvidia' -> 'NVDA'). Not needed for common indices.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Company name." } },
    required: ["query"],
  },
  execute: async ({ query }: { query: string }) => searchSymbol(query),
});

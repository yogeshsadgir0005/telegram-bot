import yahooFinance from "yahoo-finance2";
import axios from "axios";
import { logger } from "../utils/logger";

yahooFinance.suppressNotices(["yahooSurvey"]);

export interface Quote {
  symbol: string;
  shortName?: string;
  price?: number;
  currency?: string;
  changePercent?: number;
  change?: number;
  marketState?: string;
  previousClose?: number;
  dayHigh?: number;
  dayLow?: number;
  marketCap?: number;
  delayed?: boolean; // true when served from the end-of-day fallback source
}

async function getQuoteFromYahoo(symbol: string): Promise<Quote | null> {
  const q = await yahooFinance.quote(symbol);
  if (!q || typeof q.regularMarketPrice !== "number") return null;
  return {
    symbol: q.symbol,
    shortName: q.shortName,
    price: q.regularMarketPrice,
    currency: q.currency,
    changePercent: q.regularMarketChangePercent,
    change: q.regularMarketChange,
    marketState: q.marketState,
    previousClose: q.regularMarketPreviousClose,
    dayHigh: q.regularMarketDayHigh,
    dayLow: q.regularMarketDayLow,
    marketCap: q.marketCap,
  };
}

// Stooq has no API key and isn't rate-limited like Yahoo's unofficial API,
// but only serves end-of-day data — used as a resilience fallback, not primary.
async function getQuoteFromStooq(symbol: string): Promise<Quote | null> {
  const stooqSymbol = symbol.includes(".") ? symbol.toLowerCase() : `${symbol.toLowerCase()}.us`;
  const res = await axios.get("https://stooq.com/q/d/l/", {
    params: { s: stooqSymbol, i: "d" },
    timeout: 8000,
  });
  const lines: string[] = String(res.data).trim().split("\n");
  if (lines.length < 3 || !lines[0].startsWith("Date")) return null;

  const rows = lines.slice(1).map((l) => l.split(","));
  const [, , , , lastClose] = rows[rows.length - 1];
  const [, , , , prevClose] = rows[rows.length - 2];
  const price = Number(lastClose);
  const previousClose = Number(prevClose);
  if (!Number.isFinite(price) || !Number.isFinite(previousClose)) return null;

  const change = price - previousClose;
  return {
    symbol: symbol.toUpperCase(),
    price,
    previousClose,
    change,
    changePercent: (change / previousClose) * 100,
    delayed: true,
  };
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  try {
    const q = await getQuoteFromYahoo(symbol);
    if (q) return q;
  } catch (err) {
    logger.warn("getQuoteFromYahoo failed, falling back to Stooq", { symbol, err: String(err) });
  }

  try {
    return await getQuoteFromStooq(symbol);
  } catch (err) {
    logger.warn("getQuoteFromStooq failed", { symbol, err: String(err) });
    return null;
  }
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const results = await Promise.all(symbols.map((s) => getQuote(s)));
  return results.filter((r): r is Quote => r !== null);
}

export interface IndexSnapshot {
  name: string;
  quote: Quote | null;
}

const MAJOR_INDICES: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^DJI": "Dow Jones",
  "^IXIC": "Nasdaq",
};

export async function getMarketSnapshot(): Promise<IndexSnapshot[]> {
  const entries = Object.entries(MAJOR_INDICES);
  const quotes = await Promise.all(entries.map(([symbol]) => getQuote(symbol)));
  return entries.map(([, name], i) => ({ name, quote: quotes[i] }));
}

export async function searchSymbol(query: string): Promise<{ symbol: string; name: string }[]> {
  try {
    const res = await yahooFinance.search(query);
    return res.quotes
      .filter((q: any) => q.symbol && (q.shortname || q.longname))
      .slice(0, 5)
      .map((q: any) => ({ symbol: q.symbol, name: q.shortname ?? q.longname }));
  } catch (err) {
    logger.warn("searchSymbol failed", { query, err: String(err) });
    return [];
  }
}

import yahooFinance from "yahoo-finance2";
import axios from "axios";
import { env } from "../config/env";
import { logger } from "../utils/logger";

yahooFinance.suppressNotices(["yahooSurvey"]);

// Common index names the model would otherwise have to resolve via a slow,
// rate-limited symbol search — resolving these directly avoids burning tool
// iterations guessing (this caused real multi-minute timeouts in practice,
// e.g. "how has NIFTY been trending" repeatedly failing to find a symbol).
const INDEX_ALIASES: Record<string, string> = {
  "S&P500": "^GSPC",
  "S&P 500": "^GSPC",
  SPX: "^GSPC",
  DOW: "^DJI",
  "DOW JONES": "^DJI",
  NASDAQ: "^IXIC",
  NIFTY: "^NSEI",
  "NIFTY50": "^NSEI",
  "NIFTY 50": "^NSEI",
  SENSEX: "^BSESN",
  BANKNIFTY: "^NSEBANK",
  "BANK NIFTY": "^NSEBANK",
  FTSE: "^FTSE",
  "FTSE 100": "^FTSE",
  NIKKEI: "^N225",
  "HANG SENG": "^HSI",
  DAX: "^GDAXI",
};

function resolveSymbol(symbol: string): string {
  return INDEX_ALIASES[symbol.trim().toUpperCase()] ?? symbol;
}

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
  // Fundamentals — only available via Yahoo, undefined on the Stooq fallback.
  trailingPE?: number;
  forwardPE?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  dividendYield?: number;
  epsTrailingTwelveMonths?: number;
}

// Finnhub — key-based, not scraped, 60 req/min free tier. Tried first when
// configured since Yahoo (unofficial) and Stooq (bot-challenged) have both
// shown unreliable access in practice, including from production.
async function getQuoteFromFinnhub(symbol: string): Promise<Quote | null> {
  const res = await axios.get("https://finnhub.io/api/v1/quote", {
    params: { symbol, token: env.finnhubApiKey },
    timeout: 8000,
  });
  const d = res.data;
  if (!d || typeof d.c !== "number" || d.c === 0) return null;
  return {
    symbol: symbol.toUpperCase(),
    price: d.c,
    change: d.d,
    changePercent: d.dp,
    previousClose: d.pc,
    dayHigh: d.h,
    dayLow: d.l,
  };
}

// Second key-based fallback before dropping to scraped sources — lower rate
// limit than Finnhub (8/min vs 60/min free tier) so kept as fallback, not
// primary, but it's reliable when it does run.
async function getQuoteFromTwelveData(symbol: string): Promise<Quote | null> {
  const res = await axios.get("https://api.twelvedata.com/quote", {
    params: { symbol: toTwelveDataSymbol(symbol), apikey: env.twelveDataApiKey },
    timeout: 8000,
  });
  const d = res.data;
  if (!d || d.status === "error" || typeof d.close !== "string") return null;
  const price = Number(d.close);
  const previousClose = Number(d.previous_close);
  if (!Number.isFinite(price)) return null;
  return {
    symbol: symbol.toUpperCase(),
    shortName: d.name,
    price,
    currency: d.currency,
    change: Number(d.change),
    changePercent: Number(d.percent_change),
    previousClose,
    dayHigh: Number(d.high),
    dayLow: Number(d.low),
    fiftyTwoWeekHigh: d.fifty_two_week?.high ? Number(d.fifty_two_week.high) : undefined,
    fiftyTwoWeekLow: d.fifty_two_week?.low ? Number(d.fifty_two_week.low) : undefined,
  };
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
    trailingPE: q.trailingPE,
    forwardPE: q.forwardPE,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    dividendYield: q.trailingAnnualDividendYield,
    epsTrailingTwelveMonths: q.epsTrailingTwelveMonths,
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

export async function getQuote(rawSymbol: string): Promise<Quote | null> {
  const symbol = resolveSymbol(rawSymbol);

  // Twelve Data first per product decision (also covers fundamentals like
  // Yahoo does, unlike Finnhub's bare quote) — note its free tier is more
  // rate-limited (8 req/min) than Finnhub's (60 req/min), so a burst of
  // quote lookups will fall through to Finnhub more often under load.
  if (env.twelveDataApiKey) {
    try {
      const q = await getQuoteFromTwelveData(symbol);
      if (q) return q;
    } catch (err) {
      logger.warn("getQuoteFromTwelveData failed, falling back to Finnhub", { symbol, err: String(err) });
    }
  }

  if (env.finnhubApiKey) {
    try {
      const q = await getQuoteFromFinnhub(symbol);
      if (q) return q;
    } catch (err) {
      logger.warn("getQuoteFromFinnhub failed, falling back to Yahoo", { symbol, err: String(err) });
    }
  }

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

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

// Finnhub's free tier restricts /stock/candle for some symbols/plans — this
// degrades to null (not an error) so the Yahoo/Stooq fallback chain handles it.
async function getPriceHistoryFromFinnhub(symbol: string, days: number): Promise<PricePoint[] | null> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - (days + 10) * 24 * 60 * 60;
  const res = await axios.get("https://finnhub.io/api/v1/stock/candle", {
    params: { symbol, resolution: "D", from, to, token: env.finnhubApiKey },
    timeout: 8000,
  });
  const d = res.data;
  if (!d || d.s !== "ok" || !Array.isArray(d.c) || d.c.length < 2) return null;

  const points: PricePoint[] = d.t.map((t: number, i: number) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    close: d.c[i],
  }));
  return points.slice(-days);
}

// Twelve Data doesn't paywall historical time-series on the free tier
// (unlike Finnhub) and covers NSE — tried before Yahoo/Stooq for that reason.
function toTwelveDataSymbol(symbol: string): string {
  if (symbol.endsWith(".NS")) return `${symbol.slice(0, -3)}:NSE`;
  return symbol.replace(/^\^/, "");
}

async function getPriceHistoryFromTwelveData(symbol: string, days: number): Promise<PricePoint[] | null> {
  const res = await axios.get("https://api.twelvedata.com/time_series", {
    params: { symbol: toTwelveDataSymbol(symbol), interval: "1day", outputsize: days, apikey: env.twelveDataApiKey },
    timeout: 8000,
  });
  const d = res.data;
  if (!d || d.status === "error" || !Array.isArray(d.values) || d.values.length < 2) return null;

  const points: PricePoint[] = d.values
    .map((v: { datetime: string; close: string }) => ({ date: v.datetime, close: Number(v.close) }))
    .filter((p: PricePoint) => Number.isFinite(p.close))
    .reverse(); // Twelve Data returns newest-first

  return points.length >= 2 ? points : null;
}

async function getPriceHistoryFromYahoo(symbol: string, days: number): Promise<PricePoint[] | null> {
  const period1 = new Date(Date.now() - (days + 10) * 24 * 60 * 60 * 1000); // pad for weekends/holidays
  const chart = await yahooFinance.chart(symbol, { period1, interval: "1d" });
  const points: PricePoint[] = (chart.quotes ?? [])
    .filter((q) => typeof q.close === "number" && q.date)
    .map((q) => ({ date: q.date.toISOString().slice(0, 10), close: q.close as number }));
  return points.length >= 2 ? points.slice(-days) : null;
}

// Index symbols (^NSEI, ^GSPC, ...) don't get a Stooq ".us" suffix; Stooq's
// coverage of non-US tickers is inconsistent, so this is a fallback only —
// Yahoo (tried first) has much better international/index coverage.
async function getPriceHistoryFromStooq(symbol: string, days: number): Promise<PricePoint[] | null> {
  const stooqSymbol = symbol.startsWith("^") || symbol.includes(".") ? symbol.toLowerCase() : `${symbol.toLowerCase()}.us`;
  const res = await axios.get("https://stooq.com/q/d/l/", {
    params: { s: stooqSymbol, i: "d" },
    timeout: 8000,
  });
  const lines: string[] = String(res.data).trim().split("\n");
  if (lines.length < 3 || !lines[0].startsWith("Date")) return null;

  const points: PricePoint[] = lines
    .slice(1)
    .map((line) => {
      const [date, , , , close] = line.split(",");
      return { date, close: Number(close) };
    })
    .filter((p) => p.date && Number.isFinite(p.close));

  return points.length >= 2 ? points.slice(-days) : null;
}

export async function getPriceHistory(rawSymbol: string, days = 90): Promise<PricePoint[] | null> {
  const symbol = resolveSymbol(rawSymbol);

  // Twelve Data first per product decision — also the only one of the two
  // that actually works for historical data on its free tier (Finnhub 403s
  // on candles regardless of symbol, confirmed empirically), so this order
  // also skips a guaranteed-fail step in the common case.
  if (env.twelveDataApiKey) {
    try {
      const points = await getPriceHistoryFromTwelveData(symbol, days);
      if (points) return points;
    } catch (err) {
      logger.warn("getPriceHistoryFromTwelveData failed, falling back to Finnhub", { symbol, err: String(err) });
    }
  }

  if (env.finnhubApiKey) {
    try {
      const points = await getPriceHistoryFromFinnhub(symbol, days);
      if (points) return points;
    } catch (err) {
      logger.warn("getPriceHistoryFromFinnhub failed, falling back to Yahoo", { symbol, err: String(err) });
    }
  }

  try {
    const points = await getPriceHistoryFromYahoo(symbol, days);
    if (points) return points;
  } catch (err) {
    logger.warn("getPriceHistoryFromYahoo failed, falling back to Stooq", { symbol, err: String(err) });
  }

  try {
    return await getPriceHistoryFromStooq(symbol, days);
  } catch (err) {
    logger.warn("getPriceHistoryFromStooq failed", { symbol, err: String(err) });
    return null;
  }
}

export interface StockTrend {
  symbol: string;
  periodDays: number;
  startDate: string;
  startPrice: number;
  endDate: string;
  endPrice: number;
  percentChange: number;
  periodHigh: number;
  periodLow: number;
  direction: "up" | "down" | "flat";
}

export async function getStockTrend(symbol: string, days = 90): Promise<StockTrend | null> {
  const history = await getPriceHistory(symbol, days);
  if (!history || history.length < 2) return null;

  const start = history[0];
  const end = history[history.length - 1];
  const percentChange = ((end.close - start.close) / start.close) * 100;
  const closes = history.map((p) => p.close);

  return {
    symbol: symbol.toUpperCase(),
    periodDays: history.length,
    startDate: start.date,
    startPrice: start.close,
    endDate: end.date,
    endPrice: end.close,
    percentChange,
    periodHigh: Math.max(...closes),
    periodLow: Math.min(...closes),
    direction: percentChange > 0.5 ? "up" : percentChange < -0.5 ? "down" : "flat",
  };
}

export async function compareStockTrends(symbols: string[], days = 90): Promise<StockTrend[]> {
  const results = await Promise.all(symbols.map((s) => getStockTrend(s, days)));
  return results.filter((r): r is StockTrend => r !== null);
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

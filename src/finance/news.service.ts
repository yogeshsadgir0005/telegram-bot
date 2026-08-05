import Parser from "rss-parser";
import { logger } from "../utils/logger";

const parser = new Parser({ timeout: 8000 });

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt?: string;
  summary?: string;
}

// Trusted, public, no-API-key-required finance news feeds.
const FEEDS: { url: string; source: string }[] = [
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance" },
  { url: "https://feeds.marketwatch.com/marketwatch/topstories/", source: "MarketWatch" },
  { url: "https://www.cnbc.com/id/10000664/device/rss/rss.html", source: "CNBC Finance" },
  { url: "https://www.investing.com/rss/news.rss", source: "Investing.com" },
];

export function fingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
}

export async function fetchFinanceNews(limit = 30): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items ?? []).map((item) => ({
        title: item.title ?? "",
        link: item.link ?? "",
        source: feed.source,
        publishedAt: item.isoDate ?? item.pubDate,
        summary: item.contentSnippet?.slice(0, 300),
      }));
    })
  );

  const items: NewsItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
    else logger.warn("news feed fetch failed", { err: String(r.reason) });
  }

  // De-duplicate near-identical headlines across sources.
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const item of items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))) {
    if (!item.title) continue;
    const fp = fingerprint(item.title);
    if (seen.has(fp)) continue;
    seen.add(fp);
    deduped.push(item);
  }

  return deduped.slice(0, limit);
}

export async function fetchNewsForQuery(query: string, limit = 8): Promise<NewsItem[]> {
  const all = await fetchFinanceNews(60);
  const q = query.toLowerCase();
  return all.filter((item) => item.title.toLowerCase().includes(q) || item.summary?.toLowerCase().includes(q)).slice(0, limit);
}

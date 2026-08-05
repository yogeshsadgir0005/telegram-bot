import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../../utils/logger";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// DuckDuckGo's HTML results link through a redirect (//duckduckgo.com/l/?uddg=<encoded target>);
// unwrap it so the agent cites the real source instead of a DDG redirect.
function resolveRealUrl(href: string): string {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const target = url.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : href;
  } catch {
    return href;
  }
}

// Best-effort live web search with no API key required, used as a fallback
// when local finance tools (quotes/news) don't cover what the user asked.
export async function webSearch(query: string, limit = 5): Promise<SearchResult[]> {
  try {
    const res = await axios.get("https://html.duckduckgo.com/html/", {
      params: { q: query },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AtlasAI/1.0)" },
      timeout: 8000,
    });
    const $ = cheerio.load(res.data);
    const results: SearchResult[] = [];

    $(".result").each((_, el) => {
      if (results.length >= limit) return;
      const titleEl = $(el).find(".result__a");
      const title = titleEl.text().trim();
      const url = resolveRealUrl(titleEl.attr("href") ?? "");
      const snippet = $(el).find(".result__snippet").text().trim();
      if (title && url) results.push({ title, url, snippet });
    });

    return results;
  } catch (err) {
    logger.warn("webSearch failed", { query, err: String(err) });
    return [];
  }
}

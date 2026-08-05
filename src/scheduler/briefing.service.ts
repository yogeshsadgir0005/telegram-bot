import { chatCompletion } from "../ai/llm";
import { IUser } from "../db/models/User";
import { BriefingLog, BriefingType } from "../db/models/BriefingLog";
import { fetchFinanceNews, fetchNewsForQuery, fingerprint, NewsItem } from "../finance/news.service";
import { getMarketSnapshot, getQuotes } from "../finance/marketData.service";
import { getRecentInboxItems } from "../integrations/google/gmail.service";
import { isGoogleConnected } from "../integrations/google/oauth";
import { logger } from "../utils/logger";

interface BriefingResult {
  sent: boolean;
  message?: string;
  headlineKeys: string[];
}

const RECENT_LOOKBACK_DAYS = 3;

async function recentlySentKeys(telegramId: number): Promise<Set<string>> {
  const since = new Date(Date.now() - RECENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const logs = await BriefingLog.find({ telegramId, sent: true, createdAt: { $gte: since } }, { headlineKeys: 1 }).lean();
  const keys = new Set<string>();
  for (const log of logs) for (const k of log.headlineKeys) keys.add(k);
  return keys;
}

async function gatherMaterial(user: IUser): Promise<{ items: NewsItem[]; marketLine: string; inboxNote: string }> {
  const [general, snapshot] = await Promise.all([fetchFinanceNews(25), getMarketSnapshot()]);

  const personalized: NewsItem[] = [];
  for (const company of user.companiesFollowed.slice(0, 5)) {
    personalized.push(...(await fetchNewsForQuery(company, 4)));
  }
  for (const topic of user.topics.slice(0, 5)) {
    personalized.push(...(await fetchNewsForQuery(topic, 3)));
  }

  const seen = new Set<string>();
  const items = [...personalized, ...general].filter((item) => {
    const fp = fingerprint(item.title);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });

  const marketLine = snapshot
    .filter((s) => s.quote)
    .map((s) => `${s.name}: ${s.quote!.changePercent! >= 0 ? "+" : ""}${s.quote!.changePercent?.toFixed(2)}%`)
    .join(", ");

  let inboxNote = "";
  if (await isGoogleConnected(user.telegramId)) {
    const inbox = await getRecentInboxItems(user.telegramId, 10);
    if (inbox && inbox.length) {
      inboxNote = inbox
        .slice(0, 10)
        .map((i) => `From: ${i.from} | Subject: ${i.subject} | ${i.snippet}`)
        .join("\n");
    }
  }

  return { items, marketLine, inboxNote };
}

function curationPrompt(user: IUser, type: BriefingType, material: Awaited<ReturnType<typeof gatherMaterial>>, excludeKeys: Set<string>): string {
  const newsBlock = material.items
    .slice(0, 40)
    .map((i) => `- [${i.source}] ${i.title}${i.summary ? ` — ${i.summary}` : ""} (${i.link})`)
    .join("\n");

  const label: Record<BriefingType, string> = {
    morning: "Morning Briefing",
    evening: "Evening Summary",
    breaking: "Breaking Update check",
    weekly: "Weekly Digest",
  };

  return `Generate a ${label[type]} for this user. You are curating, not reporting everything.

USER PROFILE:
- Role: ${user.role ?? "unknown"}
- Verticals: ${["finance", ...user.verticals].join(", ")}
- Topics tracked: ${user.topics.join(", ") || "none specified"}
- Companies followed: ${user.companiesFollowed.join(", ") || "none specified"}

MARKET SNAPSHOT: ${material.marketLine || "unavailable"}

CANDIDATE NEWS ITEMS (deduplicated headlines from trusted sources):
${newsBlock || "none available"}

${material.inboxNote ? `RECENT INBOX ITEMS:\n${material.inboxNote}\n` : ""}

ALREADY SENT RECENTLY (do not repeat these, identify by near-duplicate topic even if wording differs):
${[...excludeKeys].slice(0, 50).join(", ") || "none"}

INSTRUCTIONS:
- Select only items that are genuinely important, novel (not already sent), and relevant to this user's profile. Quality over quantity — 0 to 4 items is normal.
- For each item you include, explain in one short line WHY it matters (impact, not just what happened).
- If nothing meaningful and new exists, do not force content — recommend silence.
- Keep the whole message short enough to read in under 10 seconds (roughly 2-6 lines, occasional "•" bullets). No headers, no long paragraphs.
- Include a brief source attribution per item (e.g. "(CNBC)").
- Never fabricate figures — only use what's in the candidate items or market snapshot above.

Respond with ONLY a raw JSON object, no markdown fences, in this exact shape:
{"send": true or false, "message": "the telegram message text, or empty string if send is false", "headline_keys": ["short lowercase fingerprint per included item, 3-8 words each"]}`;
}

export async function generateBriefing(user: IUser, type: BriefingType): Promise<BriefingResult> {
  try {
    const [material, excludeKeys] = await Promise.all([gatherMaterial(user), recentlySentKeys(user.telegramId)]);

    if (!material.items.length && !material.marketLine) {
      return { sent: false, headlineKeys: [] };
    }

    const completion = await chatCompletion({
      messages: [{ role: "user", content: curationPrompt(user, type, material, excludeKeys) }],
      temperature: 0.3,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn("briefing: unparseable model output", { telegramId: user.telegramId, type });
      return { sent: false, headlineKeys: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]) as { send: boolean; message: string; headline_keys?: string[] };
    if (!parsed.send || !parsed.message?.trim()) {
      return { sent: false, headlineKeys: [] };
    }

    return { sent: true, message: parsed.message.trim(), headlineKeys: parsed.headline_keys ?? [] };
  } catch (err) {
    logger.error("generateBriefing failed", { telegramId: user.telegramId, type, err: String(err) });
    return { sent: false, headlineKeys: [] };
  }
}

export async function logBriefing(telegramId: number, type: BriefingType, result: BriefingResult): Promise<void> {
  await BriefingLog.create({ telegramId, type, sent: result.sent, headlineKeys: result.headlineKeys });
}

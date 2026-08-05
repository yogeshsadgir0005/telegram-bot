import { User } from "../db/models/User";

const MAX_COMPANIES = 25;

// Learns from tool usage during conversations rather than a separate
// onboarding form: every symbol looked up or topic searched nudges the
// user's profile so future briefings and answers get more targeted.
export async function recordToolUsage(telegramId: number, toolName: string, args: Record<string, unknown>): Promise<void> {
  const updates: { $addToSet?: Record<string, unknown>; $inc?: Record<string, number> } = {};

  if (toolName === "get_stock_quote" && Array.isArray(args.symbols)) {
    const symbols = (args.symbols as string[]).map((s) => s.toUpperCase()).slice(0, 5);
    updates.$addToSet = { companiesFollowed: { $each: symbols } };
  }

  const query = (args.query as string | undefined)?.trim();
  const incFields: Record<string, number> = {};
  if (query && (toolName === "search_finance_news" || toolName === "web_search" || toolName === "search_ticker_symbol")) {
    const key = query.toLowerCase().slice(0, 60);
    incFields[`personalization.topicFrequency.${sanitizeKey(key)}`] = 1;
  }

  const ops: Record<string, unknown> = {};
  if (updates.$addToSet) ops.$addToSet = updates.$addToSet;
  if (Object.keys(incFields).length) ops.$inc = incFields;
  if (Object.keys(ops).length === 0) return;

  await User.updateOne({ telegramId }, ops);

  // Cap companiesFollowed length to avoid unbounded growth.
  const user = await User.findOne({ telegramId }, { companiesFollowed: 1 });
  if (user && user.companiesFollowed.length > MAX_COMPANIES) {
    user.companiesFollowed = user.companiesFollowed.slice(-MAX_COMPANIES);
    await user.save();
  }
}

export async function getTopTopics(telegramId: number, n = 5): Promise<string[]> {
  const user = await User.findOne({ telegramId }, { "personalization.topicFrequency": 1 });
  const freq = user?.personalization?.topicFrequency ?? {};
  return Object.entries(freq)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, n)
    .map(([k]) => k);
}

function sanitizeKey(key: string): string {
  // Mongo disallows "." and "$" in map keys used via dot-path updates.
  return key.replace(/[.$]/g, "_");
}

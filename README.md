# Atlas AI — Intelligent Telegram Assistant

A conversational AI assistant that lives inside Telegram, proactively surfaces what matters instead of waiting for commands, and gets more personalized the more you talk to it. Built for the **Finance** vertical: market data, curated news, inbox intelligence, and spreadsheet Q&A — synthesized, not dumped.

## Why it's built this way

- **Silence is a feature.** Daily briefings only send if the AI decides there's something genuinely new and important. No filler, no "nothing happened today but here's yesterday's news again."
- **Curation over aggregation.** Every briefing pulls from multiple trusted sources, deduplicates, cross-references what was already sent in the last few days, and asks the model to justify *why* each item matters — not just list it.
- **Two deep integrations, not ten shallow ones.** Gmail (important-emails-only + inbox intelligence) and Google Sheets (natural-language spreadsheet Q&A) were chosen because they map directly onto how finance professionals actually work: reading inboxes and tracking numbers in spreadsheets.
- **Tool-grounded answers.** The AI never states a price, statistic, or headline from memory — every factual claim comes from a tool call (live quote, news feed, web search) and is cited. If it can't verify something, it says so.

## Architecture

```
Telegram  <->  Telegraf bot  <->  Agent (NVIDIA NIM, Llama 3.3 70B, tool-calling)
                    |                      |
                    |                      +-- market data (Yahoo Finance)
                    |                      +-- finance news (RSS: Yahoo/MarketWatch/CNBC/Investing.com)
                    |                      +-- web search (DuckDuckGo, no key required)
                    |                      +-- Gmail (Google OAuth, read-only)
                    |                      +-- Google Sheets (Google OAuth, read-only)
                    |
              MongoDB (users, conversation history, preferences, integration tokens)
                    |
              node-cron scheduler --> Daily Intelligence (morning/evening/breaking/weekly)
                    |
              Express server --> Google OAuth callback endpoint
```

- `src/bot/` — Telegram conversation flows: onboarding, chat, settings, integrations.
- `src/ai/` — LLM client, tool registry, the tool-calling agent loop, personalization tracking.
- `src/finance/` — market data + news services (no paid API keys required).
- `src/integrations/google/` — OAuth, Gmail, Sheets services.
- `src/scheduler/` — proactive Daily Intelligence: curation prompt + cron triggers.
- `src/db/` — Mongoose models and connection.

## Setup

### 1. Prerequisites
- Node.js 20+
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or an Atlas free-tier cluster
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- An NVIDIA API key from [build.nvidia.com](https://build.nvidia.com) (free credits available)

### 2. Install

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required: `TELEGRAM_BOT_TOKEN`, `MONGODB_URI`, `NVIDIA_API_KEY`.

Optional (enables Gmail + Sheets integrations): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Create these in [Google Cloud Console](https://console.cloud.google.com) (OAuth consent screen + OAuth client ID, type "Web application"), enable the Gmail API and Google Sheets API, and set the authorized redirect URI to match `GOOGLE_REDIRECT_URI` (default `http://localhost:3000/integrations/google/callback`). Without these, the bot runs fine — `/connect` will just tell the user Google isn't configured.

### 4. Run

```bash
npm run dev
```

This starts the bot (long-polling, no public URL needed) and a local Express server (for the Google OAuth callback only). Message your bot on Telegram to try it.

For production: `npm run build && npm start`.

## Using the bot

- `/start` — conversational onboarding (skippable anytime with /skip)
- Just talk naturally — *"what happened in markets today"*, *"how's NVDA doing"*, *"compare AAPL and MSFT"*
- `/settings` — toggle Morning Briefing / Evening Summary / Breaking Updates / Weekly Digest
- `/connect` — link Gmail + Google Sheets (read-only)
- `/addsheet <link>` — connect a spreadsheet for Q&A once Google is linked
- `/sheets` — list connected spreadsheets
- `/disconnect` — unlink Google account

## Notes on data sources

No paid APIs are required to run this end-to-end:
- **Quotes**: Yahoo Finance (via `yahoo-finance2`, no key)
- **News**: public RSS feeds (Yahoo Finance, MarketWatch, CNBC, Investing.com)
- **Web search fallback**: DuckDuckGo HTML search (no key)
- **AI**: NVIDIA NIM free-tier API credits (Llama 3.3 70B Instruct)

These free tiers are rate-limited; swap in paid providers later by editing `src/finance/` and `.env` without touching the bot/agent logic.

**Quote resilience**: `get_stock_quote` tries Yahoo Finance first, then falls back to Stooq end-of-day data (marked `delayed: true`) if Yahoo rate-limits the request — which happens more aggressively from shared/datacenter IPs (e.g. CI, cloud sandboxes) than from a normal residential/office connection. News (RSS) and web search (DuckDuckGo) were verified working end-to-end with live data during development; if quotes ever return null in your environment, it's this upstream rate limiting, not a code bug — retry after a minute or run from a different network.

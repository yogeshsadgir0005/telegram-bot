# Atlas AI — Intelligent Telegram Assistant

A conversational AI personal assistant that lives inside Telegram — not a chatbot with a menu of buttons, but something you talk to naturally. It proactively surfaces what matters instead of waiting for commands, learns about you continuously instead of front-loading a form, and gets things done: schedules meetings, sets reminders, reads and drafts emails, and analyzes spreadsheets — either a linked Google Sheet or a file you send it directly, with real computed totals/averages, not eyeballed numbers. Built for the **Finance** vertical: market data, curated news, inbox intelligence, and spreadsheet Q&A — synthesized, not dumped.

## Why it's built this way

- **Conversation, not options.** There is no onboarding form and no settings menu of toggle buttons. `/start` sends one warm message; everything after that — your role, interests, notification preferences, what you want tracked — is picked up naturally from what you say, via tools the AI calls mid-conversation (`update_user_profile`, `update_notification_preference`).
- **Silence is a feature.** Daily briefings only send if the AI decides there's something genuinely new and important. No filler, no "nothing happened today but here's yesterday's news again."
- **Real actions, with a human always in the loop.** The assistant can send emails, create calendar meetings with real invitees, and write to shared spreadsheets — but every one of those goes through a propose → confirm → execute flow. Nothing sends, invites, or writes without you explicitly confirming in chat first (typing "yes" works exactly the same as tapping the confirm button).
- **Tool-grounded answers.** The AI never states a price, statistic, or headline from memory — every factual claim comes from a tool call (live quote, news feed, web search) and is cited. If it can't verify something, it says so.

## Architecture

```
Telegram  <->  Telegraf bot  <->  Agent (Groq / openai-gpt-oss-120b, tool-calling)
                    |                      |
                    |                      +-- market data (Finnhub quotes + Twelve Data trends, Yahoo/Stooq fallback)
                    |                      +-- finance news (RSS: Yahoo/MarketWatch/CNBC/Investing.com)
                    |                      +-- web search (DuckDuckGo, no key required)
                    |                      +-- profile & preferences (continuous learning, no forms)
                    |                      +-- reminders (Telegram + optional Calendar event)
                    |                      +-- Gmail (search, read full body, inbox summary; propose+confirm to send)
                    |                      +-- Sheets/uploaded files (read, real computed aggregates; propose+confirm to write)
                    |                      +-- Google Calendar (read agenda; propose+confirm to create meetings)
                    |
              MongoDB (users, conversation history, preferences, integration tokens, pending actions, reminders, uploaded files)
                    |
              node-cron scheduler --> Daily Intelligence + due reminders
                    |
              Express server --> Google OAuth callback endpoint
```

- `src/bot/` — Telegram wiring: commands, the chat handler, file upload handling, the one-time welcome, the pending-action confirm/cancel buttons.
- `src/ai/` — LLM client (Groq + NVIDIA runtime fallback), tool registry (25 tools), the tool-calling agent loop, the propose/confirm pending-action system, personalization tracking.
- `src/finance/` — market data + news services.
- `src/integrations/google/` — OAuth, Gmail, Sheets, Calendar services.
- `src/documents/` — spreadsheet parsing (xlsx/csv), column aggregate computation, and the unified Google-Sheet-or-uploaded-file data source layer.
- `src/scheduler/` — proactive Daily Intelligence (curation prompt + cron) and reminder delivery.
- `src/db/` — Mongoose models: User, Message, Integration, PendingAction, Reminder, BriefingLog, UploadedFile.

### The confirmation gate

`propose_email_send`, `propose_calendar_event`, and `propose_sheet_write` draft an action and store it as a `PendingAction` (auto-expires after 30 minutes) — they never perform it. The agent only calls `execute_pending_action` when your *next* message is an unambiguous confirmation; anything ambiguous gets asked about again rather than guessed. This is enforced in the system prompt and the pending-action only ever executes what was actually proposed, so there's no path for the model to silently email someone or invite people to a meeting.

## Setup

### 1. Prerequisites
- Node.js 20+
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or an Atlas free-tier cluster
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A free Groq API key from [console.groq.com/keys](https://console.groq.com/keys) (no billing card required)

### 2. Install

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required: `TELEGRAM_BOT_TOKEN`, `MONGODB_URI`, `GROQ_API_KEY`.

Optional (enables Gmail + Sheets + Calendar): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Create these in [Google Cloud Console](https://console.cloud.google.com) — OAuth consent screen + OAuth client ID (type "Web application") — and enable three APIs: **Gmail API**, **Google Sheets API**, **Google Calendar API**. Set the authorized redirect URI to match `GOOGLE_REDIRECT_URI` (default `http://localhost:3000/integrations/google/callback`). Without these, the bot runs fine — `/connect` will just tell the user Google isn't configured.

An NVIDIA NIM key (`NVIDIA_API_KEY`) can be set as a fallback provider if `GROQ_API_KEY` is absent, but Groq is strongly recommended — see [Notes on the AI provider](#notes-on-the-ai-provider) below.

### 4. Run

```bash
npm run dev
```

This starts the bot (long-polling, no public URL needed) and a local Express server (for the Google OAuth callback only). Message your bot on Telegram to try it.

For production: `npm run build && npm start`.

## Using the bot

- `/start` — one welcome message, then just talk
- Natural requests: *"what happened in markets today"*, *"how's NVDA doing"*, *"schedule a meeting with alex@co.com tomorrow 3pm"*, *"remind me to review Q3 numbers Friday 9am"*, *"what's the total of the Revenue column"*, *"search my inbox for anything from finance about the budget"*, *"what does that email actually say"*
- Send a `.xlsx` or `.csv` file directly to the chat — no Google connection needed, just ask about it afterward
- `/settings` — see current preferences as plain text; change them by just saying what you want
- `/connect` — link Gmail, Sheets & Calendar
- `/addsheet <link>` — connect a Google Sheet (or just send a file instead)
- `/sheets` — list connected sheets and uploaded files
- `/disconnect` — unlink Google account

## Notes on the AI provider

Atlas AI defaults to **Groq** (`openai/gpt-oss-120b`) rather than NVIDIA NIM. During development, NVIDIA's free-tier endpoint showed 100-300+ second latency — confirmed both locally and on the live production deployment. Groq's infrastructure is purpose-built for low-latency inference and consistently responded in under 3 seconds with reliable, correctly-typed tool-calling in testing.

Both providers' free tiers have real, finite caps (Groq: 8000 tokens/minute and ~200k tokens/day per this model on the free tier; NVIDIA: an occasional transient concurrent-request limit). Rather than picking one provider once at startup, `chatCompletion()` in `src/ai/llm.ts` tries Groq first, retries once on a short per-minute rate limit using Groq's own suggested wait time, and falls through to NVIDIA (with its own one retry) on anything else — including an exhausted daily quota, which won't clear from a retry. This is a real runtime fallback per request, not just a static config choice, so hitting one provider's ceiling doesn't take the whole bot down.

## Notes on data sources

No paid APIs are required to run this end-to-end:
- **Quotes**: Finnhub (free, key-based) primary, falling back to Yahoo Finance then Stooq end-of-day data
- **Trend/historical analysis**: Twelve Data (free, key-based) primary — Finnhub's free tier paywalls historical candles, so it's quote-only — falling back to Yahoo then Stooq
- **News**: public RSS feeds (Yahoo Finance, MarketWatch, CNBC, Investing.com)
- **Web search fallback**: DuckDuckGo HTML search (no key)
- **AI**: Groq free-tier API (`openai/gpt-oss-120b`)

Both `FINNHUB_API_KEY` and `TWELVEDATA_API_KEY` are optional — without them, everything falls back to Yahoo/Stooq (scraped, less reliable under load) but the bot still runs. With them, quotes and trends were verified working end-to-end with real live data for US/major-market tickers during development.

**Known limitation**: neither Finnhub's nor Twelve Data's free tier includes Indian exchange (NSE/BSE) data — both return explicit "upgrade your plan" errors for it, confirmed directly against their APIs. NIFTY/SENSEX/Indian-stock queries fall back to Yahoo/Stooq, which are less reliable (unofficial/scraped, subject to rate-limiting). This is an upstream data-licensing constraint common to free-tier finance APIs, not something fixable in this codebase without a paid data source. The system prompt tells the model to state this plainly rather than retry.

These free tiers are rate-limited; swap in paid providers later by editing `src/finance/marketData.service.ts` and `.env` without touching the bot/agent logic.

## Notes on file uploads

Sending a `.xlsx`, `.xls`, or `.csv` file directly to the bot (5MB limit) parses it with `exceljs`/`csv-parse` and stores the rows in MongoDB — no Google connection required, and it's queryable the same way a linked Google Sheet is (`list_connected_sheets` returns both). Deliberately not using the popular `xlsx` (SheetJS) npm package here: its npm-published build has an unpatched high-severity prototype pollution/ReDoS advisory, which matters specifically because this parses untrusted user-uploaded input.

# Atlas AI — Intelligent Telegram Assistant

A conversational AI personal assistant that lives inside Telegram — not a chatbot with a menu of buttons, but something you talk to naturally. It proactively surfaces what matters instead of waiting for commands, learns about you continuously instead of front-loading a form, and gets things done: schedules meetings, sets reminders, reads and drafts emails, and analyzes spreadsheets. Built for the **Finance** vertical: market data, curated news, inbox intelligence, and spreadsheet Q&A — synthesized, not dumped.

## Why it's built this way

- **Conversation, not options.** There is no onboarding form and no settings menu of toggle buttons. `/start` sends one warm message; everything after that — your role, interests, notification preferences, what you want tracked — is picked up naturally from what you say, via tools the AI calls mid-conversation (`update_user_profile`, `update_notification_preference`).
- **Silence is a feature.** Daily briefings only send if the AI decides there's something genuinely new and important. No filler, no "nothing happened today but here's yesterday's news again."
- **Real actions, with a human always in the loop.** The assistant can send emails, create calendar meetings with real invitees, and write to shared spreadsheets — but every one of those goes through a propose → confirm → execute flow. Nothing sends, invites, or writes without you explicitly confirming in chat first (typing "yes" works exactly the same as tapping the confirm button).
- **Tool-grounded answers.** The AI never states a price, statistic, or headline from memory — every factual claim comes from a tool call (live quote, news feed, web search) and is cited. If it can't verify something, it says so.

## Architecture

```
Telegram  <->  Telegraf bot  <->  Agent (Groq / openai-gpt-oss-120b, tool-calling)
                    |                      |
                    |                      +-- market data (Yahoo Finance + Stooq fallback)
                    |                      +-- finance news (RSS: Yahoo/MarketWatch/CNBC/Investing.com)
                    |                      +-- web search (DuckDuckGo, no key required)
                    |                      +-- profile & preferences (continuous learning, no forms)
                    |                      +-- reminders (Telegram + optional Calendar event)
                    |                      +-- Gmail (read inbox; propose+confirm to send)
                    |                      +-- Google Sheets (read/analyze; propose+confirm to write)
                    |                      +-- Google Calendar (read agenda; propose+confirm to create meetings)
                    |
              MongoDB (users, conversation history, preferences, integration tokens, pending actions, reminders)
                    |
              node-cron scheduler --> Daily Intelligence + due reminders
                    |
              Express server --> Google OAuth callback endpoint
```

- `src/bot/` — Telegram wiring: commands, the chat handler, the one-time welcome, the pending-action confirm/cancel buttons.
- `src/ai/` — LLM client, tool registry (15+ tools), the tool-calling agent loop, the propose/confirm pending-action system, personalization tracking.
- `src/finance/` — market data + news services (no paid API keys required).
- `src/integrations/google/` — OAuth, Gmail, Sheets, Calendar services.
- `src/scheduler/` — proactive Daily Intelligence (curation prompt + cron) and reminder delivery.
- `src/db/` — Mongoose models: User, Message, Integration, PendingAction, Reminder, BriefingLog.

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
- Natural requests: *"what happened in markets today"*, *"how's NVDA doing"*, *"schedule a meeting with alex@co.com tomorrow 3pm"*, *"remind me to review Q3 numbers Friday 9am"*, *"summarize trends in my sheet"*
- `/settings` — see current preferences as plain text; change them by just saying what you want
- `/connect` — link Gmail, Sheets & Calendar
- `/addsheet <link>` — connect a spreadsheet
- `/sheets` — list connected spreadsheets
- `/disconnect` — unlink Google account

## Notes on the AI provider

Atlas AI defaults to **Groq** (`openai/gpt-oss-120b`) rather than NVIDIA NIM. During development, NVIDIA's free-tier endpoint showed 100-300+ second latency and occasional outright failures — confirmed both locally and on the live production deployment, not a one-off network fluke. Groq's infrastructure is purpose-built for low-latency inference and consistently responded in under 3 seconds with reliable, correctly-typed tool-calling in testing. NVIDIA remains wired in as an automatic fallback (used if `GROQ_API_KEY` is unset) so this stays reversible without code changes — see `src/ai/llm.ts`.

## Notes on data sources

No paid APIs are required to run this end-to-end:
- **Quotes**: Yahoo Finance (via `yahoo-finance2`, no key), falling back to Stooq end-of-day data if rate-limited
- **News**: public RSS feeds (Yahoo Finance, MarketWatch, CNBC, Investing.com)
- **Web search fallback**: DuckDuckGo HTML search (no key)
- **AI**: Groq free-tier API (`openai/gpt-oss-120b`)

These free tiers are rate-limited; swap in paid providers later by editing `src/finance/` and `.env` without touching the bot/agent logic.

import express from "express";
import type { Telegraf } from "telegraf";
import { handleGoogleCallback } from "./integrations/google/oauth";
import { logger } from "./utils/logger";

export function createServer(bot: Telegraf) {
  const app = express();

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/integrations/google/callback", async (req, res) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const telegramId = state ? Number(state) : NaN;

    if (!code || Number.isNaN(telegramId)) {
      res.status(400).send("Missing code or state.");
      return;
    }

    try {
      const email = await handleGoogleCallback(code, telegramId);
      res.send(
        `<html><body style="font-family:sans-serif;text-align:center;margin-top:20vh"><h2>Connected${
          email ? ` as ${email}` : ""
        } ✅</h2><p>You can close this tab and go back to Telegram.</p></body></html>`
      );

      // The browser tab confirms success, but the user is waiting in Telegram —
      // push a confirmation there too so they know it's safe to move on.
      try {
        await bot.telegram.sendMessage(
          telegramId,
          `Google connected${email ? ` (${email})` : ""} ✅\n\nTry:\n• "what's in my inbox"\n• /addsheet <link> to connect a spreadsheet`
        );
      } catch (notifyErr) {
        logger.warn("Failed to send OAuth confirmation to Telegram", { telegramId, err: String(notifyErr) });
      }
    } catch (err) {
      logger.error("Google OAuth callback failed", { err: String(err) });
      res.status(500).send("Something went wrong connecting your Google account. Please try /connect again.");
      try {
        await bot.telegram.sendMessage(telegramId, "Connecting your Google account failed — try /connect again.");
      } catch {
        // best-effort notification only
      }
    }
  });

  return app;
}

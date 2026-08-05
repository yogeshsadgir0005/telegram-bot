import "./ai/tools"; // registers all AI tools as a side effect
import { env } from "./config/env";
import { connectDb } from "./db/mongoose";
import { bot } from "./bot/bot";
import { createServer } from "./server";
import { startScheduler } from "./scheduler/scheduler";
import { logger } from "./utils/logger";

// Telegram's API occasionally has transient connectivity blips from some
// hosts on startup; retry with backoff instead of crash-looping the deploy
// on a single failed request.
async function launchBotWithRetry(maxAttempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await bot.launch();
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delayMs = Math.min(2000 * 2 ** (attempt - 1), 30_000);
      logger.warn("bot.launch() failed, retrying", { attempt, delayMs, err: String(err) });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  await connectDb();

  const app = createServer(bot);
  app.listen(env.port, () => logger.info(`HTTP server listening on port ${env.port}`));

  startScheduler(bot);

  await launchBotWithRetry();
  logger.info("Atlas AI bot is running");
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

main().catch((err) => {
  logger.error("Fatal startup error", { err: String(err) });
  process.exit(1);
});

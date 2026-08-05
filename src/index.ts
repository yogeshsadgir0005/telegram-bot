import "./ai/tools"; // registers all AI tools as a side effect
import { env } from "./config/env";
import { connectDb } from "./db/mongoose";
import { bot } from "./bot/bot";
import { createServer } from "./server";
import { startScheduler } from "./scheduler/scheduler";
import { logger } from "./utils/logger";

async function main() {
  await connectDb();

  const app = createServer(bot);
  app.listen(env.port, () => logger.info(`HTTP server listening on port ${env.port}`));

  startScheduler(bot);

  await bot.launch();
  logger.info("Atlas AI bot is running");
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

main().catch((err) => {
  logger.error("Fatal startup error", { err: String(err) });
  process.exit(1);
});

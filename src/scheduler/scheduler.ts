import cron from "node-cron";
import { Telegraf } from "telegraf";
import { User, IUser } from "../db/models/User";
import { BriefingLog, BriefingType } from "../db/models/BriefingLog";
import { generateBriefing, logBriefing } from "./briefing.service";
import { currentTimeInTz } from "./time";
import { logger } from "../utils/logger";

async function alreadyProcessedToday(telegramId: number, type: BriefingType, lookbackHours: number): Promise<boolean> {
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const existing = await BriefingLog.findOne({ telegramId, type, createdAt: { $gte: since } });
  return Boolean(existing);
}

async function runBriefingForUser(bot: Telegraf, user: IUser, type: BriefingType): Promise<void> {
  const result = await generateBriefing(user, type);
  await logBriefing(user.telegramId, type, result);
  if (result.sent && result.message) {
    try {
      await bot.telegram.sendMessage(user.telegramId, result.message);
      logger.info("briefing sent", { telegramId: user.telegramId, type });
    } catch (err) {
      logger.warn("failed to send briefing", { telegramId: user.telegramId, type, err: String(err) });
    }
  }
}

export function startScheduler(bot: Telegraf): void {
  // Every minute: check morning/evening/weekly windows against each user's local time.
  cron.schedule("* * * * *", async () => {
    const users = await User.find({ onboardingStep: "done" });

    for (const user of users) {
      const { hhmm, dayOfWeek } = currentTimeInTz(user.timezone);

      if (user.notifications.morningBriefing.enabled && user.notifications.morningBriefing.time === hhmm) {
        if (!(await alreadyProcessedToday(user.telegramId, "morning", 20))) {
          runBriefingForUser(bot, user, "morning").catch((err) => logger.error("morning briefing error", { err: String(err) }));
        }
      }

      if (user.notifications.eveningSummary.enabled && user.notifications.eveningSummary.time === hhmm) {
        if (!(await alreadyProcessedToday(user.telegramId, "evening", 20))) {
          runBriefingForUser(bot, user, "evening").catch((err) => logger.error("evening summary error", { err: String(err) }));
        }
      }

      if (
        user.notifications.weeklyDigest.enabled &&
        user.notifications.weeklyDigest.dayOfWeek === dayOfWeek &&
        user.notifications.weeklyDigest.time === hhmm
      ) {
        if (!(await alreadyProcessedToday(user.telegramId, "weekly", 6 * 24))) {
          runBriefingForUser(bot, user, "weekly").catch((err) => logger.error("weekly digest error", { err: String(err) }));
        }
      }
    }
  });

  // Every 45 minutes: opportunistically check for genuinely breaking news.
  // Most checks should resolve to silence — the LLM decides, we don't force it.
  cron.schedule("*/45 * * * *", async () => {
    const users = await User.find({ onboardingStep: "done", "notifications.breakingUpdates.enabled": true });
    for (const user of users) {
      runBriefingForUser(bot, user, "breaking").catch((err) => logger.error("breaking update error", { err: String(err) }));
    }
  });

  logger.info("Scheduler started");
}

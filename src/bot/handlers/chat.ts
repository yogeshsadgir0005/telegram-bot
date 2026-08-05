import { Context } from "telegraf";
import { IUser } from "../../db/models/User";
import { runAgent } from "../../ai/agent";
import { logger } from "../../utils/logger";

export async function handleChatMessage(ctx: Context, user: IUser, text: string): Promise<void> {
  // Telegram's "typing" indicator auto-expires after ~5s, so refresh it
  // periodically for slower turns (tool calls can take a while) instead
  // of it silently disappearing and looking like the bot dropped the message.
  await ctx.sendChatAction("typing");
  const typingInterval = setInterval(() => {
    ctx.sendChatAction("typing").catch(() => {});
  }, 4000);

  try {
    const reply = await runAgent(user.telegramId, text, user);
    await ctx.reply(reply, { parse_mode: undefined });
  } catch (err) {
    logger.error("agent failed", { telegramId: user.telegramId, err: String(err) });
    await ctx.reply("That's taking longer than expected to look up — mind trying again in a moment?");
  } finally {
    clearInterval(typingInterval);
  }
}

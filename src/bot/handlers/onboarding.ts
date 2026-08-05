import { Context } from "telegraf";
import { IUser } from "../../db/models/User";

// One warm opening message, no forced question sequence — everything after
// this is just normal conversation. The assistant learns the user's role,
// interests, and preferences over time via update_user_profile as they come
// up naturally, per the product's "learn continuously, don't front-load a
// form" design goal.
export async function sendWelcome(ctx: Context, user: IUser): Promise<void> {
  user.onboardingStep = "done";
  await user.save();

  await ctx.reply(
    `Hey${user.firstName ? " " + user.firstName : ""} — I'm Atlas. Think of me less as a chatbot and more like a colleague who keeps you ahead on finance and handles the busywork: I can pull market news, answer questions about your inbox or spreadsheets, schedule meetings, set reminders, and send a daily briefing when there's something worth knowing.\n\n` +
      `No forms to fill out — just tell me what you're working on, what you care about, or ask me anything, and I'll pick it up as we go. Connect Gmail/Sheets/Calendar anytime with /connect.`
  );
}

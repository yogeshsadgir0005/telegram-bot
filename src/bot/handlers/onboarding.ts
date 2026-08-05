import { Context } from "telegraf";
import { IUser } from "../../db/models/User";
import { verticalsKeyboard, scheduleKeyboard, skipKeyboard } from "../keyboards";

export async function beginOnboarding(ctx: Context, user: IUser): Promise<void> {
  user.onboardingStep = "role";
  await user.save();

  await ctx.reply(
    `Hey${user.firstName ? " " + user.firstName : ""} 👋 I'm Atlas — think of me less as a chatbot and more as a colleague who keeps you ahead of what matters.\n\n` +
      `Quick one to start: what do you do day-to-day? (job, role, what you're focused on)`,
    skipKeyboard()
  );
}

export async function handleOnboardingText(ctx: Context, user: IUser, text: string): Promise<void> {
  switch (user.onboardingStep) {
    case "role": {
      user.role = text.slice(0, 300);
      user.onboardingStep = "verticals";
      await user.save();
      await ctx.reply(
        "Got it. Finance is built in as your primary vertical — I'll go deep there.\n\nAnything else you'd like me to also pay attention to? (tap any that apply, then Continue)",
        verticalsKeyboard(user.verticals)
      );
      return;
    }
    case "topics": {
      const items = text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 15);
      user.topics = items;
      user.onboardingStep = "schedule";
      await user.save();
      await ctx.reply("Noted. Last thing — when should I send your morning briefing?", scheduleKeyboard());
      return;
    }
    default: {
      // Onboarding already complete or in a callback-driven step; ignore stray text.
      return;
    }
  }
}

export async function handleVerticalToggle(ctx: Context, user: IUser, vertical: string): Promise<void> {
  const idx = user.verticals.indexOf(vertical);
  if (idx >= 0) user.verticals.splice(idx, 1);
  else user.verticals.push(vertical);
  await user.save();
  await ctx.editMessageReplyMarkup(verticalsKeyboard(user.verticals).reply_markup);
}

export async function handleVerticalContinue(ctx: Context, user: IUser): Promise<void> {
  user.onboardingStep = "topics";
  await user.save();
  await ctx.reply(
    "What topics, industries, or companies do you want me to track? (comma-separated — e.g. \"semiconductors, Fed policy, NVDA, AAPL\")\n\nOr tap Skip and I'll learn this from our conversations.",
    skipKeyboard()
  );
}

export async function handleScheduleChoice(ctx: Context, user: IUser, choice: string): Promise<void> {
  if (choice !== "skip") {
    user.notifications.morningBriefing.enabled = true;
    user.notifications.morningBriefing.time = choice;
  }
  user.onboardingStep = "done";
  await user.save();
  await finishOnboarding(ctx, user);
}

export async function skipOnboarding(ctx: Context, user: IUser): Promise<void> {
  user.onboardingStep = "done";
  user.onboardingSkipped = true;
  await user.save();
  await ctx.reply(
    "No problem — you're all set. Ask me anything, anytime (e.g. \"what happened in markets today\"), and tune preferences later with /settings."
  );
}

async function finishOnboarding(ctx: Context, user: IUser): Promise<void> {
  const summary = [
    `You're set, ${user.firstName ?? "there"} 🎯`,
    `Vertical: Finance${user.verticals.length ? " + " + user.verticals.map(cap).join(", ") : ""}`,
    user.topics.length ? `Tracking: ${user.topics.join(", ")}` : undefined,
    user.notifications.morningBriefing.enabled
      ? `Morning briefing: ${user.notifications.morningBriefing.time}`
      : undefined,
    "",
    "Just talk to me naturally — try \"what happened in markets today\" or \"how's NVDA doing\". Use /settings anytime to adjust, or /connect to link Gmail & Sheets.",
  ]
    .filter(Boolean)
    .join("\n");
  await ctx.reply(summary);
}

function cap(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

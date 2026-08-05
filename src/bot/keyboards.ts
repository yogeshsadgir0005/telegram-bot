import { Markup } from "telegraf";

// The only buttons in the product: a quick-confirm shortcut for actions with
// real external side effects (sending an email, inviting people to a
// meeting, writing to a shared sheet). Typing "yes"/"cancel" works exactly
// the same — these are a convenience, not a required menu.
export function pendingActionKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ Confirm", "pending:confirm"), Markup.button.callback("✖️ Cancel", "pending:cancel")],
  ]);
}

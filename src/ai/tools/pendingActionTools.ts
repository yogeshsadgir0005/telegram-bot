import { registerTool } from "./registry";
import { getLatestPending, markConfirmed, markCancelled } from "../pendingAction.service";
import { sendEmail } from "../../integrations/google/gmail.service";
import { createEvent } from "../../integrations/google/calendar.service";
import { writeSheetData } from "../../integrations/google/sheets.service";

registerTool({
  name: "execute_pending_action",
  description:
    "Actually perform the most recently proposed action (email send, calendar event, or sheet write) for this user. ONLY call this when the user's most recent message clearly and explicitly confirms it (e.g. 'yes', 'send it', 'go ahead', 'confirm'). If there is any ambiguity about what they're confirming, ask instead of calling this.",
  parameters: { type: "object", properties: {} },
  execute: async (_args, ctx) => {
    const pending = await getLatestPending(ctx.telegramId);
    if (!pending) return { error: "Nothing pending to confirm." };

    let result: unknown;
    if (pending.type === "email_send") {
      result = await sendEmail(ctx.telegramId, pending.payload as any);
    } else if (pending.type === "calendar_event") {
      result = await createEvent(ctx.telegramId, pending.payload as any);
    } else {
      result = await writeSheetData(ctx.telegramId, pending.payload as any);
    }

    await markConfirmed(String(pending._id));
    return { executed: true, type: pending.type, result };
  },
});

registerTool({
  name: "cancel_pending_action",
  description: "Cancel the most recently proposed action instead of executing it. Call this when the user declines or asks to change something.",
  parameters: { type: "object", properties: {} },
  execute: async (_args, ctx) => {
    const pending = await getLatestPending(ctx.telegramId);
    if (!pending) return { error: "Nothing pending to cancel." };
    await markCancelled(String(pending._id));
    return { cancelled: true };
  },
});

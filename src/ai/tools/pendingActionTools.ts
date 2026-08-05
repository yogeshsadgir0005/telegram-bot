import { registerTool } from "./registry";
import { getLatestPending, markConfirmed, markCancelled } from "../pendingAction.service";
import { sendEmail } from "../../integrations/google/gmail.service";
import { createEvent } from "../../integrations/google/calendar.service";
import { writeSheetData } from "../../integrations/google/sheets.service";

registerTool({
  name: "execute_pending_action",
  description: "Perform the most recently proposed action. ONLY call when the user's latest message unambiguously confirms it ('yes'/'send it'/'confirm'). Ask instead if unsure.",
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
  description: "Cancel the most recently proposed action. Call when the user declines or wants to change it.",
  parameters: { type: "object", properties: {} },
  execute: async (_args, ctx) => {
    const pending = await getLatestPending(ctx.telegramId);
    if (!pending) return { error: "Nothing pending to cancel." };
    await markCancelled(String(pending._id));
    return { cancelled: true };
  },
});

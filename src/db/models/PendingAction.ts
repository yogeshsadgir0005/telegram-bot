import { Schema, model, Document } from "mongoose";

export type PendingActionType = "email_send" | "calendar_event" | "sheet_write";
export type PendingActionStatus = "pending" | "confirmed" | "cancelled";

export interface IPendingAction extends Document {
  telegramId: number;
  type: PendingActionType;
  description: string; // human-readable summary shown to the user
  payload: Record<string, unknown>; // data needed to actually execute
  status: PendingActionStatus;
  createdAt: Date;
  expiresAt: Date;
}

const pendingActionSchema = new Schema<IPendingAction>(
  {
    telegramId: { type: Number, required: true, index: true },
    type: { type: String, enum: ["email_send", "calendar_event", "sheet_write"], required: true },
    description: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Stale unconfirmed proposals auto-expire so a "yes" much later in an
// unrelated conversation can never accidentally execute an old one.
pendingActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingAction = model<IPendingAction>("PendingAction", pendingActionSchema);

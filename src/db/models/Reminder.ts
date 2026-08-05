import { Schema, model, Document } from "mongoose";

export interface IReminder extends Document {
  telegramId: number;
  message: string;
  dueAt: Date;
  calendarEventId?: string;
  sent: boolean;
  createdAt: Date;
}

const reminderSchema = new Schema<IReminder>(
  {
    telegramId: { type: Number, required: true, index: true },
    message: { type: String, required: true },
    dueAt: { type: Date, required: true },
    calendarEventId: String,
    sent: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

reminderSchema.index({ dueAt: 1, sent: 1 });

export const Reminder = model<IReminder>("Reminder", reminderSchema);

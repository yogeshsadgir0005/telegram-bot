import { Schema, model, Document } from "mongoose";

export type BriefingType = "morning" | "evening" | "breaking" | "weekly";

export interface IBriefingLog extends Document {
  telegramId: number;
  type: BriefingType;
  sent: boolean; // false when skipped due to "nothing meaningful" logic
  headlineKeys: string[]; // fingerprints of items included, for dedupe across days
  createdAt: Date;
}

const briefingLogSchema = new Schema<IBriefingLog>(
  {
    telegramId: { type: Number, required: true, index: true },
    type: { type: String, enum: ["morning", "evening", "breaking", "weekly"], required: true },
    sent: { type: Boolean, required: true },
    headlineKeys: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

briefingLogSchema.index({ telegramId: 1, type: 1, createdAt: -1 });

export const BriefingLog = model<IBriefingLog>("BriefingLog", briefingLogSchema);

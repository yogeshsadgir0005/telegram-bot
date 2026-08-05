import { Schema, model, Document } from "mongoose";

export interface IMessage extends Document {
  telegramId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    telegramId: { type: Number, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Keep lookups by user + recency fast; history is trimmed in application code.
messageSchema.index({ telegramId: 1, createdAt: -1 });

export const Message = model<IMessage>("Message", messageSchema);

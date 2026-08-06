import { Schema, model, Document } from "mongoose";

export interface IUploadedFile extends Document {
  telegramId: number;
  name: string;
  values: string[][]; // same shape as Google Sheets values: row 0 = headers
  uploadedAt: Date;
}

const uploadedFileSchema = new Schema<IUploadedFile>(
  {
    telegramId: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    values: { type: [[String]], required: true },
  },
  { timestamps: { createdAt: "uploadedAt", updatedAt: false } }
);

export const UploadedFile = model<IUploadedFile>("UploadedFile", uploadedFileSchema);

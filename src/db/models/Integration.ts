import { Schema, model, Document } from "mongoose";

export interface IGoogleSheet {
  sheetId: string;
  title: string;
  url: string;
  addedAt: Date;
}

export interface IIntegration extends Document {
  telegramId: number;
  google?: {
    connected: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiryDate?: number;
    scopes: string[];
    email?: string;
  };
  sheets: IGoogleSheet[];
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = new Schema<IIntegration>(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    google: {
      connected: { type: Boolean, default: false },
      accessToken: String,
      refreshToken: String,
      expiryDate: Number,
      scopes: { type: [String], default: [] },
      email: String,
    },
    sheets: {
      type: [
        new Schema<IGoogleSheet>(
          {
            sheetId: { type: String, required: true },
            title: { type: String, required: true },
            url: { type: String, required: true },
            addedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Integration = model<IIntegration>("Integration", integrationSchema);

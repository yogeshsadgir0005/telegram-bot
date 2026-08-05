import { Schema, model, Document } from "mongoose";

export interface NotificationWindow {
  enabled: boolean;
  time: string; // "HH:mm" 24h, in user's timezone
}

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName?: string;

  onboardingStep:
    | "start"
    | "role"
    | "verticals"
    | "topics"
    | "schedule"
    | "done";
  onboardingSkipped: boolean;

  role?: string; // what the user does day to day
  verticals: string[]; // e.g. ["finance", "technology"]
  topics: string[]; // interests, e.g. ["AI regulation", "semiconductors"]
  industries: string[]; // followed industries
  companiesFollowed: string[]; // tickers / company names

  timezone: string; // IANA tz, default UTC
  notifications: {
    morningBriefing: NotificationWindow;
    eveningSummary: NotificationWindow;
    breakingUpdates: { enabled: boolean };
    weeklyDigest: { enabled: boolean; dayOfWeek: number; time: string };
  };

  personalization: {
    topicFrequency: Record<string, number>;
    lastActiveAt: Date;
    conversationSummary: string; // rolling summary of long-term context
  };

  createdAt: Date;
  updatedAt: Date;
}

const notificationWindowSchema = new Schema<NotificationWindow>(
  {
    enabled: { type: Boolean, default: true },
    time: { type: String, default: "08:00" },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    username: String,
    firstName: String,

    onboardingStep: {
      type: String,
      enum: ["start", "role", "verticals", "topics", "schedule", "done"],
      default: "start",
    },
    onboardingSkipped: { type: Boolean, default: false },

    role: String,
    verticals: { type: [String], default: ["finance"] },
    topics: { type: [String], default: [] },
    industries: { type: [String], default: [] },
    companiesFollowed: { type: [String], default: [] },

    timezone: { type: String, default: "UTC" },
    notifications: {
      morningBriefing: { type: notificationWindowSchema, default: () => ({ enabled: true, time: "08:00" }) },
      eveningSummary: { type: notificationWindowSchema, default: () => ({ enabled: false, time: "18:00" }) },
      breakingUpdates: {
        type: new Schema({ enabled: { type: Boolean, default: true } }, { _id: false }),
        default: () => ({ enabled: true }),
      },
      weeklyDigest: {
        type: new Schema(
          { enabled: { type: Boolean, default: true }, dayOfWeek: { type: Number, default: 1 }, time: { type: String, default: "09:00" } },
          { _id: false }
        ),
        default: () => ({ enabled: true, dayOfWeek: 1, time: "09:00" }),
      },
    },

    personalization: {
      topicFrequency: { type: Schema.Types.Mixed, default: {} },
      lastActiveAt: { type: Date, default: Date.now },
      conversationSummary: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);

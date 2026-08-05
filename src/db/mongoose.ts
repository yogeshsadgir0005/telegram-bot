import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri);
  logger.info("MongoDB connected", { uri: env.mongodbUri.replace(/\/\/.*@/, "//***@") });
}

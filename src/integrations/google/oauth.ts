import { google } from "googleapis";
import { env } from "../../config/env";
import { Integration } from "../../db/models/Integration";
import { logger } from "../../utils/logger";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function newOAuthClient() {
  return new google.auth.OAuth2(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);
}

// State encodes the Telegram user id so the OAuth callback knows who connected.
export function getGoogleAuthUrl(telegramId: number): string {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state: String(telegramId),
  });
}

export async function handleGoogleCallback(code: string, telegramId: number): Promise<string | undefined> {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data } = await oauth2.userinfo.get();

  await Integration.findOneAndUpdate(
    { telegramId },
    {
      telegramId,
      google: {
        connected: true,
        accessToken: tokens.access_token ?? undefined,
        refreshToken: tokens.refresh_token ?? undefined,
        expiryDate: tokens.expiry_date ?? undefined,
        scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
        email: data.email ?? undefined,
      },
    },
    { upsert: true }
  );

  logger.info("Google account connected", { telegramId, email: data.email });
  return data.email ?? undefined;
}

export async function getAuthorizedGoogleClient(telegramId: number) {
  const integration = await Integration.findOne({ telegramId });
  if (!integration?.google?.connected || !integration.google.refreshToken) {
    return null;
  }

  const client = newOAuthClient();
  client.setCredentials({
    access_token: integration.google.accessToken,
    refresh_token: integration.google.refreshToken,
    expiry_date: integration.google.expiryDate,
  });

  client.on("tokens", async (tokens) => {
    const update: Record<string, unknown> = {};
    if (tokens.access_token) update["google.accessToken"] = tokens.access_token;
    if (tokens.expiry_date) update["google.expiryDate"] = tokens.expiry_date;
    if (Object.keys(update).length > 0) {
      await Integration.updateOne({ telegramId }, { $set: update });
    }
  });

  return client;
}

export async function isGoogleConnected(telegramId: number): Promise<boolean> {
  const integration = await Integration.findOne({ telegramId });
  return Boolean(integration?.google?.connected);
}

export async function disconnectGoogle(telegramId: number): Promise<void> {
  await Integration.updateOne({ telegramId }, { $set: { google: { connected: false, scopes: [] }, sheets: [] } });
}

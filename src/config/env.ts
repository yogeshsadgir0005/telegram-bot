import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  mongodbUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/atlas-ai"),

  nvidiaApiKey: process.env.NVIDIA_API_KEY ?? "",
  nvidiaBaseUrl: required("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
  nvidiaModel: required("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct"),

  // Optional low-latency provider (Groq, OpenAI-compatible). Takes priority
  // over NVIDIA when set — see ai/llm.ts.
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqBaseUrl: required("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
  groqModel: required("GROQ_MODEL", "openai/gpt-oss-120b"),

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/integrations/google/callback",

  port: Number(process.env.PORT ?? 3000),

  isGoogleConfigured(): boolean {
    return Boolean(this.googleClientId && this.googleClientSecret);
  },
};

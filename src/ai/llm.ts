import OpenAI from "openai";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// NVIDIA NIM and Groq both expose OpenAI-compatible Chat Completions APIs,
// so the official openai SDK works unmodified against either by pointing
// baseURL at the chosen provider. Groq is preferred when configured: its
// infrastructure is built specifically for low-latency inference, whereas
// NVIDIA's free-tier endpoint has shown 100-300s latency in production
// (confirmed on the live Render deployment, not just locally), which makes
// Telegram replies unusably slow. NVIDIA remains the fallback so this stays
// reversible without code changes.
const useGroq = Boolean(env.groqApiKey);

export const llm = new OpenAI({
  apiKey: (useGroq ? env.groqApiKey : env.nvidiaApiKey) || "missing-key",
  baseURL: useGroq ? env.groqBaseUrl : env.nvidiaBaseUrl,
  timeout: useGroq ? 30_000 : 150_000,
  maxRetries: useGroq ? 1 : 0,
});

export const LLM_MODEL = useGroq ? env.groqModel : env.nvidiaModel;

logger.info("AI provider selected", { provider: useGroq ? "groq" : "nvidia", model: LLM_MODEL });

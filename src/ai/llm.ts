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
  // Retries handled explicitly below (parses Groq's actual suggested wait
  // time from the 429 body) rather than the SDK's generic backoff, which
  // wasn't waiting long enough for the TPM window to actually reset.
  maxRetries: 0,
});

export const LLM_MODEL = useGroq ? env.groqModel : env.nvidiaModel;

logger.info("AI provider selected", { provider: useGroq ? "groq" : "nvidia", model: LLM_MODEL });

type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

function extractRetryDelaySeconds(err: unknown): number | null {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/try again in ([\d.]+)s/i);
  return match ? Number(match[1]) : null;
}

// Groq's free-tier TPM limit (8000 tokens/min for this model) means a burst
// of messages within the same minute can hit a 429 even when everything is
// otherwise healthy — Groq's error body tells us exactly how long to wait,
// so honor that instead of guessing or failing immediately.
export async function chatCompletion(params: ChatParams) {
  try {
    return await llm.chat.completions.create(params);
  } catch (err: any) {
    const isRateLimit = err?.status === 429;
    const delaySeconds = isRateLimit ? extractRetryDelaySeconds(err) : null;
    if (!isRateLimit || delaySeconds === null) throw err;

    const waitMs = Math.min(delaySeconds * 1000 + 250, 15_000); // small buffer, capped
    logger.warn("LLM rate limited, waiting then retrying once", { waitMs });
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return await llm.chat.completions.create(params);
  }
}

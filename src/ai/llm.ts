import OpenAI from "openai";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// NVIDIA NIM and Groq both expose OpenAI-compatible Chat Completions APIs,
// so the official openai SDK works unmodified against either by pointing
// baseURL at the chosen provider. Groq is tried first (built for
// low-latency inference; NVIDIA's free-tier endpoint has shown 100-300s
// latency in production). Both clients are created up front (not a static
// startup choice) so a Groq failure — rate limit, outage, exhausted daily
// quota — can fall back to NVIDIA for that same request instead of taking
// the whole bot down until Groq's quota resets.
const groqClient = env.groqApiKey
  ? new OpenAI({ apiKey: env.groqApiKey, baseURL: env.groqBaseUrl, timeout: 30_000, maxRetries: 0 })
  : null;
const nvidiaClient = env.nvidiaApiKey
  ? new OpenAI({ apiKey: env.nvidiaApiKey, baseURL: env.nvidiaBaseUrl, timeout: 150_000, maxRetries: 0 })
  : null;

logger.info("AI providers configured", { groq: Boolean(groqClient), nvidia: Boolean(nvidiaClient) });

type ChatParams = Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "model">;

function extractRetryDelaySeconds(err: unknown): number | null {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/try again in ([\d.]+)s/i);
  return match ? Number(match[1]) : null;
}

// A daily-quota 429 won't clear for hours — retrying the same provider is
// pointless, go straight to the fallback. A per-minute 429 clears in
// seconds and is worth one retry on the same provider first.
function isDailyQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /tokens per day/i.test(message);
}

export async function chatCompletion(params: ChatParams) {
  if (groqClient) {
    try {
      return await groqClient.chat.completions.create({ ...params, model: env.groqModel });
    } catch (err: any) {
      const isRateLimit = err?.status === 429;

      if (isRateLimit && !isDailyQuotaError(err)) {
        const delaySeconds = extractRetryDelaySeconds(err);
        if (delaySeconds !== null) {
          const waitMs = Math.min(delaySeconds * 1000 + 250, 15_000);
          logger.warn("Groq rate limited (per-minute), retrying once", { waitMs });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          try {
            return await groqClient.chat.completions.create({ ...params, model: env.groqModel });
          } catch (retryErr) {
            logger.warn("Groq retry also failed, falling back to NVIDIA", { err: String(retryErr) });
          }
        }
      } else {
        logger.warn("Groq request failed, falling back to NVIDIA", { err: String(err), dailyQuotaExhausted: isRateLimit });
      }

      if (nvidiaClient) {
        return await nvidiaClient.chat.completions.create({ ...params, model: env.nvidiaModel });
      }
      throw err;
    }
  }

  if (nvidiaClient) {
    return await nvidiaClient.chat.completions.create({ ...params, model: env.nvidiaModel });
  }

  throw new Error("No AI provider configured — set GROQ_API_KEY or NVIDIA_API_KEY.");
}

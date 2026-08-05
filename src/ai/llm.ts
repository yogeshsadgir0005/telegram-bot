import OpenAI from "openai";
import { env } from "../config/env";

// NVIDIA NIM exposes an OpenAI-compatible Chat Completions API, so the
// official openai SDK works unmodified by pointing baseURL at NVIDIA.
// Timeout is generous because NVIDIA's free-tier endpoint can be slow
// depending on network path/load; a turn may need two round-trips
// (tool call + follow-up), so this bounds worst case rather than
// assuming typical (usually much faster) latency.
export const llm = new OpenAI({
  apiKey: env.nvidiaApiKey || "missing-key",
  baseURL: env.nvidiaBaseUrl,
  timeout: 150_000,
  maxRetries: 0,
});

export const LLM_MODEL = env.nvidiaModel;

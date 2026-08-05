import type OpenAI from "openai";
import { llm, LLM_MODEL } from "./llm";
import { buildSystemPrompt } from "./prompts/systemPrompt";
import { toOpenAiToolSchemas, findTool } from "./tools";
import { User, IUser } from "../db/models/User";
import { Message } from "../db/models/Message";
import { recordToolUsage } from "./personalization.service";
import { logger } from "../utils/logger";

const HISTORY_LIMIT = 12; // recent turns kept as raw context
const MAX_TOOL_ITERATIONS = 5;

async function loadHistory(telegramId: number): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
  const recent = await Message.find({ telegramId }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT).lean();
  return recent
    .reverse()
    .map((m) => ({ role: m.role, content: m.content } as OpenAI.Chat.Completions.ChatCompletionMessageParam));
}

export async function runAgent(telegramId: number, userMessage: string, user: IUser): Promise<string> {
  const history = await loadHistory(telegramId);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(user) },
    ...history,
    { role: "user", content: userMessage },
  ];

  let finalText = "";
  const tools = toOpenAiToolSchemas();

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const completion = await llm.chat.completions.create({
      model: LLM_MODEL,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? "auto" : undefined,
      temperature: 0.4,
      max_tokens: 700,
    });

    const choice = completion.choices[0];
    const msg = choice.message;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      finalText = msg.content?.trim() ?? "";
      break;
    }

    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });

    for (const call of msg.tool_calls) {
      const tool = findTool(call.function.name);
      let result: unknown;
      try {
        const parsed = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        // Some models emit a bare "null" (which JSON.parse resolves to the
        // primitive null, not {}) when a tool takes no meaningful args.
        const args = parsed && typeof parsed === "object" ? parsed : {};
        result = tool ? await tool.execute(args, { telegramId }) : { error: `Unknown tool: ${call.function.name}` };
        recordToolUsage(telegramId, call.function.name, args).catch(() => {});
      } catch (err) {
        logger.warn("tool execution failed", { tool: call.function.name, err: String(err) });
        result = { error: "Tool execution failed." };
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 8000),
      });
    }

    if (i === MAX_TOOL_ITERATIONS - 1) {
      finalText = "I looked into that but couldn't finish pulling everything together — try asking again in a moment.";
    }
  }

  await Message.create({ telegramId, role: "user", content: userMessage });
  if (finalText) {
    await Message.create({ telegramId, role: "assistant", content: finalText });
  }

  await User.updateOne({ telegramId }, { $set: { "personalization.lastActiveAt": new Date() } });

  return finalText || "Sorry, I couldn't come up with a response there — could you rephrase?";
}

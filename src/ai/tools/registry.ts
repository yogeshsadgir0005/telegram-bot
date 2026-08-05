import type OpenAI from "openai";

export interface ToolContext {
  telegramId: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
  execute: (args: any, ctx: ToolContext) => Promise<unknown>;
}

const tools: ToolDefinition[] = [];

export function registerTool(tool: ToolDefinition): void {
  tools.push(tool);
}

export function getRegisteredTools(): ToolDefinition[] {
  return tools;
}

export function toOpenAiToolSchemas(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function findTool(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}

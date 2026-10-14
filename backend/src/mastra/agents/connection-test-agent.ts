import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { getBackendEnv } from "../../config/env.js";

const envPath = fs.existsSync(".env.local")
  ? path.resolve(".env.local")
  : path.resolve("..", ".env.local");

dotenv.config({ path: envPath });

export function createConnectionAgent(): Agent {
  const env = getBackendEnv();

  const archestra = createOpenAI({
    apiKey: env.ARCHESTRA_VIRTUAL_KEY,
    baseURL: env.ARCHESTRA_BASE_URL,
  });

  return new Agent({
    id: "archestra-connection-test",
    name: "Archestra Connection Test",
    instructions:
      "You are an integration test agent. Follow the user instructions exactly.",
    model: archestra.chat(env.ARCHESTRA_MODEL),
  });
}

export const connectionTestAgent: Agent = new Proxy({} as Agent, {
  get(_target, prop) {
    const agent = createConnectionAgent();
    const value = (agent as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(agent);
    }
    return value;
  },
});

export function isArchestraConfigured(): boolean {
  try {
    const env = getBackendEnv();
    return Boolean(
      env.ARCHESTRA_VIRTUAL_KEY?.trim() &&
      env.ARCHESTRA_BASE_URL?.trim() &&
      env.ARCHESTRA_MODEL?.trim(),
    );
  } catch {
    return false;
  }
}

export interface RunConnectionTestResult {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export async function runConnectionTest(
  prompt: string,
): Promise<RunConnectionTestResult> {
  const agent = createConnectionAgent();
  const result = await agent.generate(prompt);
  const rawUsage = (result as unknown as { usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }).usage;
  return {
    text: result.text,
    ...(rawUsage ? { usage: rawUsage } : {}),
  };
}

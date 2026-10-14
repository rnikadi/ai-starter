import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";

const envPath = fs.existsSync(".env.local")
  ? path.resolve(".env.local")
  : path.resolve("..", ".env.local");

dotenv.config({ path: envPath });

export function getArchestraBaseUrl(): string {
  const configured = (process.env.ARCHESTRA_BASE_URL || "http://localhost:9000/v1").trim();
  const internalUrl = process.env.ARCHESTRA_INTERNAL_URL?.trim();

  if (!internalUrl) {
    return configured;
  }

  try {
    const parsedConfigured = new URL(configured);
    if (parsedConfigured.hostname === "localhost" || parsedConfigured.hostname === "127.0.0.1") {
      const parsedInternal = new URL(internalUrl);
      parsedConfigured.protocol = parsedInternal.protocol;
      parsedConfigured.host = parsedInternal.host;
      return parsedConfigured.toString().replace(/\/+$/, "");
    }
  } catch {
    return configured;
  }

  return configured;
}

export function createConnectionAgent(): Agent {
  const apiKey = process.env.ARCHESTRA_VIRTUAL_KEY || "missing-archestra-key";
  const baseURL = getArchestraBaseUrl();
  const modelId = process.env.ARCHESTRA_MODEL || "missing-model-id";

  const archestra = createOpenAI({
    apiKey,
    baseURL,
  });

  return new Agent({
    id: "archestra-connection-test",
    name: "Archestra Connection Test",
    instructions:
      "You are an integration test agent. Follow the user instructions exactly.",
    model: archestra.chat(modelId),
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
  return Boolean(
    process.env.ARCHESTRA_VIRTUAL_KEY?.trim() &&
    (process.env.ARCHESTRA_BASE_URL?.trim() || getArchestraBaseUrl()) &&
    process.env.ARCHESTRA_MODEL?.trim()
  );
}

export function isMockAiEnabled(): boolean {
  return process.env.MOCK_AI === "true" || process.env.MOCK_AI === "1";
}

export async function runConnectionTest(
  prompt: string,
): Promise<{ text: string; mocked: boolean }> {
  if (isMockAiEnabled()) {
    return {
      text: `[MOCK AI MODE] Connection test successful. Received prompt: "${prompt}". Mastra agent simulated response (no external API calls made).`,
      mocked: true,
    };
  }

  const agent = createConnectionAgent();
  const result = await agent.generate(prompt);
  return {
    text: result.text,
    mocked: false,
  };
}

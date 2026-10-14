import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";

const envPath = fs.existsSync(".env.local")
  ? path.resolve(".env.local")
  : path.resolve("..", ".env.local");

dotenv.config({ path: envPath });

const apiKey = process.env.ARCHESTRA_VIRTUAL_KEY || "missing-archestra-key";
const baseURL = process.env.ARCHESTRA_BASE_URL || "http://localhost:9000/v1";
const modelId = process.env.ARCHESTRA_MODEL || "missing-model-id";

const archestra = createOpenAI({
  apiKey,
  baseURL,
});

export const connectionTestAgent = new Agent({
  id: "archestra-connection-test",
  name: "Archestra Connection Test",
  instructions:
    "You are an integration test agent. Follow the user instructions exactly.",
  model: archestra.chat(modelId),
});

export function isArchestraConfigured(): boolean {
  return Boolean(
    process.env.ARCHESTRA_VIRTUAL_KEY &&
    process.env.ARCHESTRA_BASE_URL &&
    process.env.ARCHESTRA_MODEL
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

  const result = await connectionTestAgent.generate(prompt);
  return {
    text: result.text,
    mocked: false,
  };
}

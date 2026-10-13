import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';

const apiKey = process.env.ARCHESTRA_VIRTUAL_KEY;
const baseURL = process.env.ARCHESTRA_BASE_URL;
const modelId = process.env.ARCHESTRA_MODEL;

if (!apiKey) {
  throw new Error('ARCHESTRA_VIRTUAL_KEY is not configured');
}

if (!baseURL) {
  throw new Error('ARCHESTRA_BASE_URL is not configured');
}

if (!modelId) {
  throw new Error('ARCHESTRA_MODEL is not configured');
}

const archestra = createOpenAI({
  apiKey,
  baseURL,
});

export const connectionTestAgent = new Agent({
  id: 'archestra-connection-test',
  name: 'Archestra Connection Test',
  instructions:
    'You are an integration test agent. Follow the user instructions exactly.',
  model: archestra.chat(modelId),
});

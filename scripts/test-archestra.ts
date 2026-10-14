import dotenv from 'dotenv';

const envResult = dotenv.config({ path: '.env.local' });

if (envResult.error) {
  throw new Error(
    `Could not load .env.local: ${envResult.error.message}`,
  );
}

if (!process.env.ARCHESTRA_VIRTUAL_KEY) {
  throw new Error(
    'ARCHESTRA_VIRTUAL_KEY is missing from .env.local',
  );
}

const { connectionTestAgent } = await import(
  '../backend/src/mastra/agents/connection-test-agent.js'
);

async function main(): Promise<void> {
  const prompt =
    'Reply with exactly: MASTRA_ARCHESTRA_CONNECTION_SUCCESS';

  try {
    console.log('Testing Mastra -> Archestra -> OpenRouter...');

    const response = await connectionTestAgent.generate(prompt);

    console.log('\nModel response:');
    console.log(response.text);

    if (
      response.text.trim() !==
      'MASTRA_ARCHESTRA_CONNECTION_SUCCESS'
    ) {
      console.error('\nUnexpected response from the model.');
      process.exitCode = 1;
      return;
    }

    console.log(
      '\nSUCCESS: Mastra reached Archestra and received the expected response.',
    );
  } catch (error) {
    console.error('\nIntegration test failed.');

    console.error(
      error instanceof Error ? error.message : String(error),
    );

    process.exitCode = 1;
  }
}

void main();

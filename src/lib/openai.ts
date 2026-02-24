import OpenAI from 'openai';

let openai: OpenAI;

function getOpenAIClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY is not set. OpenAI operations will fail.");
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'placeholder-for-build',
    });
  }
  return openai;
}

const getAgentId = () => process.env.OPENAI_AGENT_ID!;

/**
 * Creates a new OpenAI Thread for a new conversation.
 */
export async function createThread() {
  const client = getOpenAIClient();
  const thread = await client.beta.threads.create();
  return thread.id;
}

/**
 * Adds a message to an existing thread and runs the Assistant.
 * Returns the text of the Assistant's response.
 */
export async function handleUserMessage(threadId: string, message: string): Promise<string | null> {
  try {
    const client = getOpenAIClient();
    const AGENT_ID = getAgentId();

    // 1. Add the user's message to the thread
    await client.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

    // 2. Run the Assistant
    const run = await client.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: AGENT_ID,
    });

    // 3. Handle the run status
    if (run.status === 'completed') {
      const messages = await client.beta.threads.messages.list(threadId);
      
      for (const msg of messages.data) {
        if (msg.role === 'assistant') {
           const textContent = msg.content.find(c => c.type === 'text');
           if (textContent && textContent.type === 'text') {
             return textContent.text.value;
           }
        }
      }
      return 'No text response from AI.';
    } else {
      console.error(`Run finished with unexpected status: ${run.status}`);
      return `Error: Agent run status was ${run.status}`;
    }

  } catch (error) {
    console.error('Error communicating with OpenAI:', error);
    return null;
  }
}

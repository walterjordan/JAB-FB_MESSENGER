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
 * Creates a new pseudo-thread ID for the conversation.
 * If using the new responses API with agent_id, the history array serves as state,
 * but we still use threadId to fetch from Airtable.
 */
export async function createThread() {
  return crypto.randomUUID();
}

/**
 * Handles the user message by using the new OpenAI Responses API.
 */
export async function handleUserMessage(threadId: string, message: string, conversationHistory: any[] = []): Promise<string | null> {
  try {
    const client = getOpenAIClient();
    const AGENT_ID = getAgentId();

    // Append the new user message to the existing history
    const inputHistory = [
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const response = await client.responses.create({
      agent_id: AGENT_ID,
      input: inputHistory,
    } as any);

    // Depending on the exact typing of the new SDK, extract the text.
    // theplan.md suggests `response.output_text`
    const reply = (response as any).output_text || (response as any).text || (response as any).content || 'No text response from AI.';

    return reply;

  } catch (error) {
    console.error('Error communicating with OpenAI Agent API:', error);
    return null;
  }
}

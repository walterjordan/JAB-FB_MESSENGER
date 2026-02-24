import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AGENT_ID = process.env.OPENAI_AGENT_ID!;

/**
 * Creates a new OpenAI Thread for a new conversation.
 */
export async function createThread() {
  const thread = await openai.beta.threads.create();
  return thread.id;
}

/**
 * Adds a message to an existing thread and runs the Assistant.
 * Returns the text of the Assistant's response.
 */
export async function handleUserMessage(threadId: string, message: string): Promise<string | null> {
  try {
    // 1. Add the user's message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

    // 2. Run the Assistant
    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: AGENT_ID,
      // You can also pass additional instructions here if needed
      // instructions: "Additional context for this specific run..." 
    });

    // 3. Handle the run status
    if (run.status === 'completed') {
      // Fetch the messages added by the assistant
      const messages = await openai.beta.threads.messages.list(threadId);
      
      // The newest message is first in the list, we want the first assistant message
      for (const msg of messages.data) {
        if (msg.role === 'assistant') {
           // Extract text content
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

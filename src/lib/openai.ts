import axios from 'axios';

// Using the CLOUD_RUN_URL from your .env.local
const MCP_URL = process.env.CLOUD_RUN_URL || 'https://jab-ai-mcp-199373649190.us-central1.run.app';
const NOTEBOOK_ID = process.env.NOTEBOOK_ID; 

/**
 * Creates a new pseudo-thread ID for the conversation.
 * NotebookLLM just needs a unique string for the conversation_id.
 */
export async function createThread(): Promise<string> {
  return crypto.randomUUID();
}

/**
 * Sends a message to the NotebookLLM MCP server.
 * Returns the text of the response.
 */
export async function handleUserMessage(threadId: string, message: string): Promise<string | null> {
  if (!NOTEBOOK_ID) {
    console.error('NOTEBOOK_ID environment variable is missing.');
    return 'System configuration error: NOTEBOOK_ID is missing. Please contact the administrator.';
  }

  try {
    const response = await axios.post(`${MCP_URL}/notebook_query`, {
      notebook_id: NOTEBOOK_ID,
      query: message,
      conversation_id: threadId
    });

    // Extract the text response from the MCP server
    if (response.data) {
        if (typeof response.data === 'string') {
            return response.data;
        } else if (response.data.text) {
            return response.data.text;
        } else if (response.data.response) {
            return response.data.response;
        } else if (response.data.answer) {
            return response.data.answer;
        } else {
             // Fallback if the response structure is unexpected
             return JSON.stringify(response.data);
        }
    }
    return 'No response data received from the brain.';

  } catch (error) {
    if (axios.isAxiosError(error)) {
         console.error('Error communicating with NotebookLLM MCP:', error.response?.data || error.message);
    } else {
         console.error('Unknown error communicating with NotebookLLM MCP:', error);
    }
    return null;
  }
}

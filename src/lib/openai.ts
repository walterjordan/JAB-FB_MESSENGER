import { Agent, Runner, AgentInputItem } from "@openai/agents";

const getAgentId = () => process.env.OPENAI_AGENT_ID || "wf_699c6879501c81908f9023abbc16e191098190d79d244a46";

/**
 * Handles the user message by using the specialized OpenAI Agents SDK.
 * This SDK is required to interact with 'wf_' workflow IDs from Agent Builder.
 */
export async function handleUserMessage(message: string, conversationHistory: any[] = []): Promise<{ reply: string, newHistory: any[] } | null> {
  try {
    const AGENT_ID = getAgentId();

    // 1. Define the Agent configuration (as shown in agentsdk.md)
    const agent = new Agent({
      name: "JAB Messenger Intent Agent",
      instructions: `You are a business automation assistant responding to Facebook Messenger inquiries. Your goals are:
Qualify the lead.
Answer questions clearly and concisely.
Offer the next step (book call, get pricing, demo, etc.).
Escalate to a human if requested.
Never fabricate pricing or policies. If missing required information, ask clarifying questions.`,
      model: "gpt-4o",
      modelSettings: {
        temperature: 1,
        topP: 1,
        maxTokens: 2048,
        store: true
      }
    });

    // 2. Format history for the SDK
    // The SDK expects `content` to be an array of objects, e.g., [{ type: "input_text", text: "..." }]
    // Previous messages retrieved from Airtable might be just `{ role: "user", content: "string" }`
    const items: AgentInputItem[] = conversationHistory.map(item => {
        if (typeof item.content === 'string') {
             return {
                 role: item.role,
                 content: [{ type: "input_text", text: item.content }]
             } as AgentInputItem;
        }
        // If it's already in the correct AgentInputItem format, return it
        return item as AgentInputItem;
    });

    // Add the new user message
    items.push({ 
        role: "user", 
        content: [{ type: "input_text", text: message }] 
    });

    // 3. Initialize the Runner with the workflow ID
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: AGENT_ID
      }
    });

    // 4. Run the agent
    const result = await runner.run(agent, items);

    if (!result.finalOutput) {
        throw new Error("Agent result is undefined");
    }

    // 5. Update history with assistant responses
    const updatedHistory = [
        ...items,
        ...result.newItems.map((item) => item.rawItem)
    ];

    return {
      reply: result.finalOutput,
      newHistory: updatedHistory
    };

  } catch (error) {
    console.error('Error communicating with OpenAI Agents SDK:', error);
    return null;
  }
}

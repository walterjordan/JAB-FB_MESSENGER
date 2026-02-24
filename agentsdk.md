import { Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";

const jabMessengerIntentAgent = new Agent({
  name: "JAB Messenger Intent Agent",
  instructions: `You are a business automation assistant responding to Facebook Messenger inquiries. Your goals are:
Qualify the lead.
Answer questions clearly and concisely.
Offer the next step (book call, get pricing, demo, etc.).
Escalate to a human if requested.
Never fabricate pricing or policies. If missing required information, ask clarifying questions.`,
  model: "gpt-4.1",
  modelSettings: {
    temperature: 1,
    topP: 1,
    maxTokens: 2048,
    store: true
  }
});

type WorkflowInput = { input_as_text: string };


// Main code entrypoint
export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace("JAB Messenger Assistant", async () => {
    const state = {

    };
    const conversationHistory: AgentInputItem[] = [
      { role: "user", content: [{ type: "input_text", text: workflow.input_as_text }] }
    ];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_699c6879501c81908f9023abbc16e191098190d79d244a46"
      }
    });
    const jabMessengerIntentAgentResultTemp = await runner.run(
      jabMessengerIntentAgent,
      [
        ...conversationHistory
      ]
    );
    conversationHistory.push(...jabMessengerIntentAgentResultTemp.newItems.map((item) => item.rawItem));

    if (!jabMessengerIntentAgentResultTemp.finalOutput) {
        throw new Error("Agent result is undefined");
    }

    const jabMessengerIntentAgentResult = {
      output_text: jabMessengerIntentAgentResultTemp.finalOutput ?? ""
    };
    return jabMessengerIntentAgentResult;
  });
}

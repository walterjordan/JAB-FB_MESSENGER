const { Agent, Runner } = require('@openai/agents');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const keyMatch = env.match(/OPENAI_API_KEY=(.*)/);
const key = keyMatch[1].trim();

process.env.OPENAI_API_KEY = key;

const agent = new Agent({
  name: "Test Agent",
  instructions: "You are a test agent.",
  model: "gpt-4o"
});

async function test() {
  try {
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_699c6879501c81908f9023abbc16e191098190d79d244a46"
      }
    });
    
    const result = await runner.run(agent, [
      { role: "user", content: [{ type: "input_text", text: "hello" }] }
    ]);
    
    console.log("SUCCESS:", result.finalOutput);
  } catch (e) {
    console.error("ERROR:", e);
  }
}
test();
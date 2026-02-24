const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const keyMatch = env.match(/OPENAI_API_KEY=(.*)/);
if (!keyMatch) throw new Error("No API key");
const key = keyMatch[1].trim();

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: key });

async function test() {
  try {
    const res = await openai.chat.completions.create({
      model: 'wf_699c6879501c81908f9023abbc16e191098190d79d244a46',
      messages: [{ role: 'user', content: 'hello' }]
    });
    console.log("SUCCESS:", res);
  } catch (e) {
    console.log("ERROR chat completions:", e.message);
  }

  try {
    const res = await openai.responses.create({
      model: 'wf_699c6879501c81908f9023abbc16e191098190d79d244a46',
      input: 'hello'
    });
    console.log("SUCCESS responses.create:", res);
  } catch (e) {
    console.log("ERROR responses.create:", e.message);
  }
}
test();
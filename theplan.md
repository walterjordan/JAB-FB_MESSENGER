Below is a **production-ready `/api/messenger` route** for a **Next.js App Router (app/api/messenger/route.ts)** deployment on **Cloud Run**.

This version includes:

* Webhook verification (GET)
* Incoming message handling (POST)
* OpenAI Agent call
* Airtable conversation persistence (optional but structured)
* Facebook Graph API reply
* Basic error isolation (so Facebook always receives 200)

You can paste this directly into:

```
app/api/messenger/route.ts
```

---

# ✅ Required Environment Variables

Set these in:

* `.env.local`
* Cloud Run → Variables & Secrets

```
FACEBOOK_VERIFY_TOKEN=your_verify_token
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_token
OPENAI_API_KEY=sk-...
OPENAI_AGENT_ID=agent_abc123

AIRTABLE_API_KEY=pat_xxx
AIRTABLE_BASE_ID=appeJqZ5jyPnh1MC
AIRTABLE_MESSENGER_TABLE=Messenger Conversations
```

---

# ✅ Install Dependencies

```
npm install openai airtable
```

---

# 🚀 Production Route Code

```ts
// app/api/messenger/route.ts

import { NextRequest } from "next/server";
import OpenAI from "openai";
import Airtable from "airtable";

const {
  FACEBOOK_VERIFY_TOKEN,
  FACEBOOK_PAGE_ACCESS_TOKEN,
  OPENAI_API_KEY,
  OPENAI_AGENT_ID,
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_MESSENGER_TABLE,
} = process.env;

// ---------- Initialize Clients ----------

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const airtable =
  AIRTABLE_API_KEY && AIRTABLE_BASE_ID
    ? new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)
    : null;

// ---------- Facebook Webhook Verification (GET) ----------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === FACEBOOK_VERIFY_TOKEN) {
    console.log("Webhook verified");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Verification failed", { status: 403 });
}

// ---------- Handle Incoming Messages (POST) ----------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const messagingEvent = body?.entry?.[0]?.messaging?.[0];
    const senderId = messagingEvent?.sender?.id;
    const messageText = messagingEvent?.message?.text;

    if (!senderId || !messageText) {
      return new Response("No message content", { status: 200 });
    }

    // ---------- Load Conversation History (Optional) ----------

    let conversationHistory: any[] = [];

    if (airtable && AIRTABLE_MESSENGER_TABLE) {
      const records = await airtable(AIRTABLE_MESSENGER_TABLE)
        .select({
          filterByFormula: `{PSID} = "${senderId}"`,
          maxRecords: 1,
        })
        .firstPage();

      if (records.length > 0) {
        const record = records[0];
        const existingLog = record.get("Conversation Log");
        if (existingLog) {
          conversationHistory = JSON.parse(existingLog as string);
        }
      }
    }

    // Append new user message
    conversationHistory.push({
      role: "user",
      content: messageText,
    });

    // ---------- Call OpenAI Agent ----------

    const response = await openai.responses.create({
      agent_id: OPENAI_AGENT_ID!,
      input: conversationHistory,
    });

    const reply =
      response.output_text ||
      "Thanks for reaching out. How can I assist you today?";

    // Append assistant reply
    conversationHistory.push({
      role: "assistant",
      content: reply,
    });

    // ---------- Persist Updated Conversation ----------

    if (airtable && AIRTABLE_MESSENGER_TABLE) {
      const records = await airtable(AIRTABLE_MESSENGER_TABLE)
        .select({
          filterByFormula: `{PSID} = "${senderId}"`,
          maxRecords: 1,
        })
        .firstPage();

      if (records.length > 0) {
        await airtable(AIRTABLE_MESSENGER_TABLE).update(records[0].id, {
          "Conversation Log": JSON.stringify(conversationHistory),
          "Last Message": messageText,
        });
      } else {
        await airtable(AIRTABLE_MESSENGER_TABLE).create({
          PSID: senderId,
          "Conversation Log": JSON.stringify(conversationHistory),
          "Last Message": messageText,
          Status: "Open",
        });
      }
    }

    // ---------- Send Reply Back to Facebook ----------

    await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${FACEBOOK_PAGE_ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: reply },
        }),
      }
    );

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("Messenger webhook error:", error);

    // IMPORTANT: Always return 200 to Facebook
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}
```

---

# 🔐 Production Hardening Recommendations

### 1️⃣ Verify Facebook Signature (Highly Recommended)

Add:

```
X-Hub-Signature-256
```

validation using your app secret to prevent spoofed requests.

---

### 2️⃣ Timeout Guard

Cloud Run default timeout should be ≥ 15s.

---

### 3️⃣ Avoid Infinite Loops

Ensure you ignore:

```
messagingEvent.message.is_echo === true
```

Add:

```ts
if (messagingEvent?.message?.is_echo) {
  return new Response("Echo ignored", { status: 200 });
}
```

---

### 4️⃣ Tool Execution Support

If your Agent uses tools, change the OpenAI call to:

```ts
const response = await openai.responses.create({
  agent_id: OPENAI_AGENT_ID!,
  input: conversationHistory,
  tools: "auto"
});
```

Then inspect `response.output` for tool calls.

---

# 🧠 What This Gives You

You now have:

* Verified Messenger webhook
* Persistent conversation memory
* Agent-powered replies
* Airtable CRM-lite storage
* Cloud Run compatible deployment
* Error-safe response handling

---

If you'd like next, I can:

* Add full Facebook signature verification
* Add lead-scoring logic
* Add Make.com webhook triggers
* Add tool-execution handler (for structured actions)
* Convert this to multi-page multi-agent routing

Tell me which layer you want to strengthen.


Below is a **production-ready `/api/messenger` route** for a **Next.js App Router (app/api/messenger/route.ts)** deployment on **Cloud Run**.

This version includes:

* Webhook verification (GET)
* Incoming message handling (POST)
* OpenAI Agent call
* Airtable conversation persistence (optional but structured)
* Facebook Graph API reply
* Basic error isolation (so Facebook always receives 200)

You can paste this directly into:

```
app/api/messenger/route.ts
```

---

# ✅ Required Environment Variables

Set these in:

* `.env.local`
* Cloud Run → Variables & Secrets

```
FACEBOOK_VERIFY_TOKEN=your_verify_token
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_token
OPENAI_API_KEY=sk-...
OPENAI_AGENT_ID=agent_abc123

AIRTABLE_API_KEY=pat_xxx
AIRTABLE_BASE_ID=appeJqZ5jyPnh1MC
AIRTABLE_MESSENGER_TABLE=Messenger Conversations
```

---

# ✅ Install Dependencies

```
npm install openai airtable
```

---

# 🚀 Production Route Code

```ts
// app/api/messenger/route.ts

import { NextRequest } from "next/server";
import OpenAI from "openai";
import Airtable from "airtable";

const {
  FACEBOOK_VERIFY_TOKEN,
  FACEBOOK_PAGE_ACCESS_TOKEN,
  OPENAI_API_KEY,
  OPENAI_AGENT_ID,
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_MESSENGER_TABLE,
} = process.env;

// ---------- Initialize Clients ----------

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const airtable =
  AIRTABLE_API_KEY && AIRTABLE_BASE_ID
    ? new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)
    : null;

// ---------- Facebook Webhook Verification (GET) ----------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === FACEBOOK_VERIFY_TOKEN) {
    console.log("Webhook verified");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Verification failed", { status: 403 });
}

// ---------- Handle Incoming Messages (POST) ----------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const messagingEvent = body?.entry?.[0]?.messaging?.[0];
    const senderId = messagingEvent?.sender?.id;
    const messageText = messagingEvent?.message?.text;

    if (!senderId || !messageText) {
      return new Response("No message content", { status: 200 });
    }

    // ---------- Load Conversation History (Optional) ----------

    let conversationHistory: any[] = [];

    if (airtable && AIRTABLE_MESSENGER_TABLE) {
      const records = await airtable(AIRTABLE_MESSENGER_TABLE)
        .select({
          filterByFormula: `{PSID} = "${senderId}"`,
          maxRecords: 1,
        })
        .firstPage();

      if (records.length > 0) {
        const record = records[0];
        const existingLog = record.get("Conversation Log");
        if (existingLog) {
          conversationHistory = JSON.parse(existingLog as string);
        }
      }
    }

    // Append new user message
    conversationHistory.push({
      role: "user",
      content: messageText,
    });

    // ---------- Call OpenAI Agent ----------

    const response = await openai.responses.create({
      agent_id: OPENAI_AGENT_ID!,
      input: conversationHistory,
    });

    const reply =
      response.output_text ||
      "Thanks for reaching out. How can I assist you today?";

    // Append assistant reply
    conversationHistory.push({
      role: "assistant",
      content: reply,
    });

    // ---------- Persist Updated Conversation ----------

    if (airtable && AIRTABLE_MESSENGER_TABLE) {
      const records = await airtable(AIRTABLE_MESSENGER_TABLE)
        .select({
          filterByFormula: `{PSID} = "${senderId}"`,
          maxRecords: 1,
        })
        .firstPage();

      if (records.length > 0) {
        await airtable(AIRTABLE_MESSENGER_TABLE).update(records[0].id, {
          "Conversation Log": JSON.stringify(conversationHistory),
          "Last Message": messageText,
        });
      } else {
        await airtable(AIRTABLE_MESSENGER_TABLE).create({
          PSID: senderId,
          "Conversation Log": JSON.stringify(conversationHistory),
          "Last Message": messageText,
          Status: "Open",
        });
      }
    }

    // ---------- Send Reply Back to Facebook ----------

    await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${FACEBOOK_PAGE_ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: reply },
        }),
      }
    );

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("Messenger webhook error:", error);

    // IMPORTANT: Always return 200 to Facebook
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}
```

---

# 🔐 Production Hardening Recommendations

### 1️⃣ Verify Facebook Signature (Highly Recommended)

Add:

```
X-Hub-Signature-256
```

validation using your app secret to prevent spoofed requests.

---

### 2️⃣ Timeout Guard

Cloud Run default timeout should be ≥ 15s.

---

### 3️⃣ Avoid Infinite Loops

Ensure you ignore:

```
messagingEvent.message.is_echo === true
```

Add:

```ts
if (messagingEvent?.message?.is_echo) {
  return new Response("Echo ignored", { status: 200 });
}
```

---

### 4️⃣ Tool Execution Support

If your Agent uses tools, change the OpenAI call to:

```ts
const response = await openai.responses.create({
  agent_id: OPENAI_AGENT_ID!,
  input: conversationHistory,
  tools: "auto"
});
```

Then inspect `response.output` for tool calls.

---

# 🧠 What This Gives You

You now have:

* Verified Messenger webhook
* Persistent conversation memory
* Agent-powered replies
* Airtable CRM-lite storage
* Cloud Run compatible deployment
* Error-safe response handling

---

If you'd like next, I can:

* Add full Facebook signature verification
* Add lead-scoring logic
* Add Make.com webhook triggers
* Add tool-execution handler (for structured actions)
* Convert this to multi-page multi-agent routing

Tell me which layer you want to strengthen.

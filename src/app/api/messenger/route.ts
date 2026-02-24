import { NextRequest } from "next/server";
import Airtable from "airtable";
import axios from 'axios';
import { handleUserMessage } from "@/lib/openai";

// ---------- Initialize Airtable Lazily ----------

let _airtable: any = null;

function getAirtable() {
  if (!_airtable) {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
      _airtable = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    }
  }
  return _airtable;
}

// ---------- Facebook Webhook Verification (GET) ----------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const { FACEBOOK_VERIFY_TOKEN } = process.env;

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

    // Ignore echoes and non-text
    if (messagingEvent?.message?.is_echo) {
      return new Response("Echo ignored", { status: 200 });
    }

    if (!senderId || !messageText) {
      return new Response("No message content", { status: 200 });
    }

    const {
      AIRTABLE_MESSENGER_TABLE,
      FACEBOOK_PAGE_ACCESS_TOKEN,
      FACEBOOK_WEBHOOK_URL,
    } = process.env;

    const airtable = getAirtable();

    // ---------- Load Conversation History ----------

    let conversationHistory: any[] = [];
    let airtableRecordId: string | null = null;

    if (airtable && AIRTABLE_MESSENGER_TABLE) {
      try {
        const records = await airtable(AIRTABLE_MESSENGER_TABLE)
          .select({
            filterByFormula: `{Facebook User ID} = "${senderId}"`,
            maxRecords: 1,
          })
          .firstPage();

        if (records.length > 0) {
          const record = records[0];
          airtableRecordId = record.id;
          const existingLog = record.get("Message History");
          if (existingLog) {
            conversationHistory = JSON.parse(existingLog as string);
          }
        }
      } catch (e) {
        console.error("Airtable fetch error:", e);
      }
    }

    // ---------- Call OpenAI Agents SDK ----------
    
    console.log(`Processing message from ${senderId}: ${messageText}`);
    
    const agentResult = await handleUserMessage(messageText, conversationHistory);
    
    let reply = "Thanks for reaching out. How can I assist you today?";
    let updatedHistory = conversationHistory;

    if (agentResult) {
        reply = agentResult.reply;
        updatedHistory = agentResult.newHistory;
    } else {
        console.error("Failed to get response from Agents SDK");
        reply = "Sorry, my brain is having a moment. I'll get back to you soon.";
    }

    // ---------- Persist Updated Conversation ----------

    if (airtable && AIRTABLE_MESSENGER_TABLE) {
      try {
        if (airtableRecordId) {
          await airtable(AIRTABLE_MESSENGER_TABLE).update(airtableRecordId, {
            "Message History": JSON.stringify(updatedHistory)
          });
        } else {
          await airtable(AIRTABLE_MESSENGER_TABLE).create({
            "Facebook User ID": senderId,
            "Message History": JSON.stringify(updatedHistory)
          });
        }
      } catch (e) {
        console.error("Airtable save error:", e);
      }
    }

    // ---------- Send Reply Back to Facebook ----------

    try {
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
    } catch (fbError) {
      console.error("Facebook API error:", fbError);
    }

    // ---------- (Optional) Make.com webhook ----------
    if (FACEBOOK_WEBHOOK_URL && FACEBOOK_WEBHOOK_URL.includes("make.com")) {
       try {
           await axios.post(FACEBOOK_WEBHOOK_URL, {
               fbUserId: senderId,
               userMessage: messageText,
               aiResponse: reply,
               timestamp: new Date().toISOString()
           });
       } catch (e) {
           console.error("Make webhook error:", e);
       }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("Messenger webhook error:", error);
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}

import { NextResponse } from 'next/server';
import { getConversation, createConversation, logMessageToAirtable } from '@/lib/airtable';
import { createThread, handleUserMessage } from '@/lib/openai';
import { sendFacebookMessage } from '@/lib/facebook';
import axios from 'axios';

// --- Verification Route for Facebook ---
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Facebook sends these parameters for verification
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK_VERIFIED');
    // Important: Must return the challenge back to Facebook as a plain text string
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  // If token mismatch
  console.log('WEBHOOK_VERIFICATION_FAILED');
  return new NextResponse('Forbidden', { status: 403 });
}

// --- Main Webhook Receiver ---
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Verify this is from a page subscription
    if (body.object !== 'page') {
      return new NextResponse('Not a page object', { status: 404 });
    }

    // 2. Process each entry (there may be multiple if batched)
    for (const entry of body.entry) {
      // Process each messaging event
      for (const event of entry.messaging) {
        
        // We only care about standard text messages right now
        if (event.message && event.message.text) {
          await processMessageEvent(event);
        } else {
            console.log('Received webhook event that is not a standard text message:', event);
        }
      }
    }

    // ALWAYS return a 200 OK to Facebook, or they will keep retrying and eventually disable the webhook
    return new NextResponse('EVENT_RECEIVED', { status: 200 });

  } catch (error) {
    console.error('Error processing webhook:', error);
    // Still return 200 to prevent Facebook from backing off, but log internally
    return new NextResponse('Internal Error Processed', { status: 200 });
  }
}

/**
 * Core business logic for handling a single user message.
 */
async function processMessageEvent(event: any) {
  const senderId = event.sender.id;
  const messageText = event.message.text;

  console.log(`Received message from ${senderId}: ${messageText}`);

  try {
    // --- 1. Load or Create Conversation State ---
    let record = await getConversation(senderId);
    let threadId: string;
    let history = '';

    if (record) {
      console.log(`Found existing conversation for user ${senderId} with Thread ID: ${record.threadId}`);
      threadId = record.threadId;
      // Ideally fetch history here if your Airtable util reads it, but we append locally for now.
    } else {
      console.log(`Creating new thread for user ${senderId}`);
      threadId = await createThread();
      record = await createConversation(senderId, threadId);
      console.log(`Created Airtable Record: ${record?.id}`);
    }

    // --- 2. Send Message to OpenAI Agent ---
    console.log(`Sending message to OpenAI thread ${threadId}`);
    // Optional: Add a typing indicator here using Graph API if desired
    
    const aiResponse = await handleUserMessage(threadId, messageText);
    
    if (!aiResponse) {
       console.error('No response received from AI Agent.');
       await sendFacebookMessage(senderId, 'Sorry, I am having trouble connecting to my brain right now.');
       return;
    }

    console.log(`AI Response: ${aiResponse}`);

    // --- 3. Send Reply to Facebook ---
    await sendFacebookMessage(senderId, aiResponse);

    // --- 4. Update Airtable (Log messages) ---
    // If you implemented the message history logic
    if (record && record.id) {
       // A proper implementation would fetch current history first, 
       // but logMessageToAirtable needs adjustment if you want full persistence
       await logMessageToAirtable(record.id, '', 'User', messageText);
       await logMessageToAirtable(record.id, '', 'AI', aiResponse);
    }

    // --- 5. (Optional) Trigger Make.com Webhook ---
    const makeWebhookUrl = process.env.FACEBOOK_WEBHOOK_URL; 
    if (makeWebhookUrl && makeWebhookUrl.includes('make.com')) {
      try {
        await axios.post(makeWebhookUrl, {
           fbUserId: senderId,
           userMessage: messageText,
           aiResponse: aiResponse,
           timestamp: new Date().toISOString()
        });
        console.log('Successfully pinged Make.com webhook');
      } catch (makeError) {
         console.error('Failed to ping Make.com webhook:', makeError);
      }
    }

  } catch (err) {
    console.error(`Failed to process message for ${senderId}:`, err);
    await sendFacebookMessage(senderId, 'An error occurred while processing your request.');
  }
}

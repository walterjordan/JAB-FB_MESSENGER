import axios from 'axios';

const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const FB_API_URL = 'https://graph.facebook.com/v21.0/me/messages';

/**
 * Sends a message back to a user on Facebook Messenger.
 */
export async function sendFacebookMessage(recipientId: string, messageText: string) {
  try {
    const response = await axios.post(
      FB_API_URL,
      {
        recipient: {
          id: recipientId,
        },
        message: {
          text: messageText,
        },
        messaging_type: 'RESPONSE',
      },
      {
        params: {
          access_token: PAGE_ACCESS_TOKEN,
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error sending Facebook message:', error.response.data);
    } else {
      console.error('Unknown error sending Facebook message:', error);
    }
  }
}

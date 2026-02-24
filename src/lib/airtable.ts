import Airtable from 'airtable';

// Initialize lazy to avoid build-time errors when ENV vars aren't present
let base: any;
let table: any;

function getAirtableTable() {
  if (!table) {
    if (!process.env.AIRTABLE_API_KEY) {
      console.warn("AIRTABLE_API_KEY is not set. Airtable operations will fail.");
    }
    const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
    base = airtable.base(process.env.AIRTABLE_BASE_ID!);
    table = base(process.env.AIRTABLE_MESSENGER_TABLE!);
  }
  return table;
}

export interface ConversationRecord {
  id: string; // Airtable Record ID
  fbUserId: string;
  threadId: string;
}

/**
 * Retrieves an existing conversation record for a Facebook User.
 * If one doesn't exist, it returns null.
 */
export async function getConversation(fbUserId: string): Promise<ConversationRecord | null> {
  try {
    const t = getAirtableTable();
    const records = await t
      .select({
        filterByFormula: `{Facebook User ID} = '${fbUserId}'`, // Assuming this column name
        maxRecords: 1,
      })
      .firstPage();

    if (records.length > 0) {
      return {
        id: records[0].id,
        fbUserId: records[0].get('Facebook User ID') as string,
        threadId: records[0].get('Thread ID') as string,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching conversation from Airtable:', error);
    return null;
  }
}

/**
 * Creates a new conversation record in Airtable for a new user.
 */
export async function createConversation(
  fbUserId: string,
  threadId: string
): Promise<ConversationRecord | null> {
  try {
    const t = getAirtableTable();
    const record = await t.create([
      {
        fields: {
          'Facebook User ID': fbUserId,
          'Thread ID': threadId,
        },
      },
    ]);

    if (record.length > 0) {
      return {
        id: record[0].id,
        fbUserId: record[0].get('Facebook User ID') as string,
        threadId: record[0].get('Thread ID') as string,
      };
    }
    return null;
  } catch (error) {
    console.error('Error creating conversation in Airtable:', error);
    return null;
  }
}

/**
 * Optionally logs individual messages to Airtable if you have a message history column.
 * Assumes a column named 'Message History' which is a long text field.
 */
export async function logMessageToAirtable(recordId: string, currentHistory: string = '', sender: 'User' | 'AI', message: string) {
    try {
        const t = getAirtableTable();
        const newHistory = `${currentHistory}\n[${new Date().toISOString()}] ${sender}: ${message}`;
        await t.update([
            {
                id: recordId,
                fields: {
                    'Message History': newHistory
                }
            }
        ])
    } catch (error) {
         console.error('Error updating message history in Airtable:', error);
    }
}

# JAB Facebook Messenger AI Responder

This repository contains the Next.js backend for a fully autonomous Facebook Messenger AI responder, built for Jordan & Borden Consulting. It leverages the official OpenAI Agents SDK, Airtable for CRM and memory persistence, and Google Cloud Run for scalable deployment.

## Architecture & Flow

The system acts as a bridge between Facebook Messenger's webhook events and an OpenAI Agent Builder workflow.

1.  **Webhook Intake:** When a user sends a message to the connected Facebook Page, Facebook triggers a `POST` request to the Cloud Run endpoint (`/api/messenger`).
2.  **Memory Retrieval:** The system queries Airtable (the `Messenger Conversations` table) using the user's unique Facebook ID. If the user has messaged before, their entire `Message History` is loaded.
3.  **Data Formatting:** The historical messages are parsed and mapped into the strict `AgentInputItem` array format required by the `@openai/agents` SDK (where `content` is an array of typed objects).
4.  **Agent Execution:** The system initializes an Agent `Runner` using the specific `workflow_id` (the `wf_...` ID from Agent Builder). The entire conversation context plus the new message is sent to the Agent.
5.  **Response Handling:** Once the Agent processes the request (including any internal tools or RAG defined in the Agent Builder), it returns a `finalOutput` string.
6.  **Persistence:** The new user message and the Agent's response are appended to the conversation history, stringified, and saved back to Airtable, updating the record for that specific user.
7.  **Delivery:** The system calls the Facebook Graph API (`/me/messages`) using the `FACEBOOK_PAGE_ACCESS_TOKEN` to deliver the Agent's response back to the user on Messenger.
8.  **Third-Party Webhooks (Optional):** Finally, it asynchronously pings a Make.com webhook with the interaction details for potential external automation (e.g., Slack alerts, external CRM sync).

## Core Technologies

*   **Framework:** Next.js (App Router)
*   **AI Engine:** `@openai/agents` SDK (Connecting to a pre-built OpenAI Agent Builder workflow)
*   **Database:** Airtable (`airtable` npm package)
*   **Deployment:** Google Cloud Run (Dockerized via `cloudbuild.yaml`)
*   **CI/CD:** Google Cloud Build Trigger (Deploy on push to `main`)

## Setup & Configuration

### Prerequisites
*   A Facebook Developer App configured for Messenger.
*   An Airtable Base with a table named `Messenger Conversations` containing two exact columns:
    *   `Facebook User ID` (Single line text)
    *   `Message History` (Long text)
*   An OpenAI Agent Builder Workflow ID (`wf_...`).
*   Google Cloud SDK installed for deployment management.

### Environment Variables
The application requires the following environment variables. In production, these are stored securely in Google Cloud Run.

```env
# Facebook Authentication
FACEBOOK_VERIFY_TOKEN=your_custom_webhook_verification_string
FACEBOOK_PAGE_ACCESS_TOKEN=EAA...
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_APP_ID=your_app_id
FACEBOOK_WEBHOOK_URL=https://hook.us2.make.com/... # Optional Make.com trigger

# Airtable Configuration
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=appe...
AIRTABLE_MESSENGER_TABLE=Messenger Conversations

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_AGENT_ID=wf_... # The Workflow ID from Agent Builder
```

## Deployment

The application is deployed via a Google Cloud Build trigger linked to the `main` branch of the GitHub repository.

1.  Push code to the `main` branch.
2.  Google Cloud Build executes the steps in `cloudbuild.yaml`.
3.  The Next.js app is built using the `standalone` output mode in a lightweight Alpine Node.js Docker container.
4.  The container is pushed to Artifact Registry and deployed to the `jab-fb-messenger` Cloud Run service.

**Important Note on Environment Variables during Deployment:**
Do not hardcode API keys in `cloudbuild.yaml`. The Cloud Run service has been manually configured with the necessary environment variables. The `cloudbuild.yaml` file specifically omits the `--set-env-vars` flag to prevent overwriting these production secrets during routine deployments.

## Local Development

1.  Clone the repository.
2.  Create a `.env.local` file with the required variables.
3.  Run `npm install`.
4.  Run `npm run dev` to start the local Next.js server on port 3000.
5.  *(Optional)* Use `ngrok http 3000` to expose the local server to the internet if you need to test live Facebook webhooks during development.

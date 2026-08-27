# RouteCause

Understand why Salesforce Omni-Channel routed a work item the way it did — and get actionable suggestions to fix it.

## What it does

1. **Connect** your Salesforce org via OAuth (one-time setup)
2. **Browse** recent AgentWork records with filters by channel, queue, and routing model
3. **Trace** a work item — get a plain-English explanation of the routing decision
4. **Verify** — mark the route as correct (👍) or incorrect (👎)
5. **Fix** — if incorrect, specify where it should have gone and get a specific configuration suggestion

## Privacy

RouteCause is designed with a hard rule: **customer data never leaves your org**. The tool only queries routing infrastructure metadata (AgentWork, RoutingConfiguration, ServiceChannel, Queue) and agent names. Work item records (Cases, Chats, etc.) are never fetched. Agent and routing data is sent to Claude to generate the explanation and suggestion.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

You need:
- **SF_CLIENT_ID** / **SF_CLIENT_SECRET** — from a Salesforce Connected App (see below)
- **SF_CALLBACK_URL** — `http://localhost:3000/api/auth/callback` for local dev
- **SESSION_SECRET** — 32-byte hex string: `openssl rand -hex 32`
- **ANTHROPIC_API_KEY** — from [console.anthropic.com](https://console.anthropic.com)

### 3. Create a Salesforce Connected App

In your org: **Setup → App Manager → New Connected App**

- Enable OAuth Settings
- Callback URL: `http://localhost:3000/api/auth/callback`
- OAuth Scopes: `api`, `refresh_token`, `offline_access`
- Save, then copy the **Consumer Key** (Client ID) and **Consumer Secret**

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be prompted to connect your org.

## Deployment (Vercel)

1. Push this repo to GitHub
2. Import in Vercel
3. Set all environment variables from `.env.local.example`
4. Update `SF_CALLBACK_URL` to your Vercel domain
5. Update the callback URL in your Salesforce Connected App to match

## Tech stack

- Next.js 14 (App Router)
- Tailwind CSS
- iron-session (server-side session, httpOnly cookie)
- Anthropic SDK (claude-sonnet-4-6)
- Salesforce REST API (SOQL)

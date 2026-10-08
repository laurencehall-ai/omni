# RouteCause

Understand why Salesforce Omni-Channel routed a work item the way it did — and get actionable suggestions to fix it.

## What it does

1. **Connect** your Salesforce org via OAuth (one-time setup)
2. **Browse** recent AgentWork records with filters by channel, queue, and routing model
3. **Trace** a work item — get the full routing chain: channel entry, OmniFlow diagram, routing results per leg
4. **Verify** — mark the route as correct (👍) or incorrect (👎)
5. **Fix** — if incorrect, specify where it should have gone and get a specific configuration suggestion

## Trace page layout

Each trace shows a three-block RouteMap:

- **Inbound Interaction** — channel, routing type (sourced from the matched flow node, not AgentWork), platform key
- **OmniFlow Diagram** — if a matching RoutingFlow is found via Tooling API, renders an interactive ReactFlow diagram with the inferred path highlighted. Confidence badge shows how the path was matched (queue ID / routing type / fallback). Copilot agent names (e.g. "Omega") are surfaced from the flow's `copilotLabel` input parameter.
- **Routing Results** — one per leg, with queue, agent, timing, capacity weight

## Privacy

RouteCause is designed with a hard rule: **customer data never leaves your org**. The tool only queries routing infrastructure metadata (AgentWork, RoutingConfiguration, ServiceChannel, Queue, Flow) and agent names. Work item records (Cases, Chats, etc.) are never fetched or forwarded. Agent and routing data is sent to Claude to generate the explanation and suggestion.

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

The connecting user needs read access to: AgentWork, ServiceChannel, Group (Queue), User, Skill, AgentWorkSkill, Flow (Tooling API), and optionally Case, VoiceCall, and MessagingSession for customer identifier lookup.

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
- iron-session v8 (server-side session, httpOnly cookie)
- Anthropic SDK (claude-sonnet-4-6)
- Salesforce REST API v62.0 + Tooling API v62.0
- ReactFlow v11.11.4 (OmniFlow diagram, client-only)

## Key Salesforce API facts

- `AgentWork.RoutingType` is always `'QueueBased'` even for Copilot/Flow-routed items — RouteCause never uses it to gate the flow lookup
- Flow Metadata is fetched via `GET /tooling/sobjects/Flow/{id}` — the `Metadata` field contains the full graph (actionCalls, decisions, connectors)
- `ProcessType = 'RoutingFlow'` is the correct filter for Omni-Channel routing flows; it lives on the `Flow` (version) object, not `FlowDefinition`
- RoutingConfig, ServicePresenceConfig, and QueueRoutingConfig are not queryable via REST in most production orgs — those fields show `—`

// ─── Salesforce REST API helpers ─────────────────────────────────────────────
// Low-level wrappers for querying Salesforce via REST and Tooling API.
// All queries use API version v62.0.

import { OrgConnection } from "./types";

const API_VERSION = "v62.0";

// Executes a SOQL query against the standard REST API endpoint.
// Returns the records array from the Salesforce query result.
// Throws if the request fails — callers handle errors.
export async function sfQuery<T>(
  org: OrgConnection,
  soql: string,
): Promise<T[]> {
  const url = `${org.instanceUrl}/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${org.accessToken}` },
    cache: "no-store", // Always fetch fresh data — never use Next.js cache for SF queries
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce query failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.records as T[];
}

// Executes a SOQL query against the Tooling API endpoint.
// Required for Setup objects like RoutingConfig, ServicePresenceConfig, and QueueRoutingConfig
// which are not accessible via the standard REST SOQL endpoint in most orgs.
// NOTE: Even the Tooling API cannot access these objects in many production orgs —
// they ultimately require Metadata API (SOAP). This is used as a best-effort attempt.
export async function sfToolingQuery<T>(
  org: OrgConnection,
  soql: string,
): Promise<T[]> {
  const url = `${org.instanceUrl}/services/data/${API_VERSION}/tooling/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${org.accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce tooling query failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.records as T[];
}

// Exchanges a refresh token for a new access token.
// Called when a session token has expired (e.g. the "invalid session ID" error).
// NOTE: Currently unused in the app — reconnecting via OAuth is the preferred flow.
export async function refreshAccessToken(
  org: OrgConnection,
): Promise<OrgConnection> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.SF_CLIENT_ID!,
    client_secret: process.env.SF_CLIENT_SECRET!,
    refresh_token: org.refreshToken,
  });
  const res = await fetch(`${org.instanceUrl}/services/oauth2/token`, {
    method: "POST",
    body: params,
  });
  if (!res.ok) throw new Error("Failed to refresh Salesforce access token");
  const data = await res.json();
  return { ...org, accessToken: data.access_token };
}

// Direct GET against the Tooling API — used for sObject records (e.g. Flow/{id}).
// Supports optional revalidation for caching flow definitions (they change rarely).
export async function sfToolingGet<T>(
  org: OrgConnection,
  path: string,
  revalidateSeconds?: number,
): Promise<T> {
  const url = `${org.instanceUrl}/services/data/${API_VERSION}/tooling${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${org.accessToken}` },
    ...(revalidateSeconds !== undefined
      ? { next: { revalidate: revalidateSeconds } }
      : { cache: "no-store" as const }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tooling API error (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

// Maps the 3-character Salesforce record ID prefix to a human-readable work item type.
// We inspect only the prefix — we never fetch the actual work item record's content.
const KEY_PREFIX_MAP: Record<string, string> = {
  "500": "Case",
  "570": "Live Chat",
  "0Mh": "Messaging Session",
  "0Oc": "Voice Call",
};

// Returns the work item type label for a given Salesforce record ID.
// Falls back to "Work Item" for any prefix not in the map.
export function workItemTypeFromId(id: string): string {
  const prefix = id.substring(0, 3);
  return KEY_PREFIX_MAP[prefix] ?? "Work Item";
}

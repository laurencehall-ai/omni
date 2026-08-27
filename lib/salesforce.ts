import { OrgConnection } from "./types";

const API_VERSION = "v62.0";

export async function sfQuery<T>(
  org: OrgConnection,
  soql: string
): Promise<T[]> {
  const url = `${org.instanceUrl}/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${org.accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce query failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.records as T[];
}

export async function refreshAccessToken(
  org: OrgConnection
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

// Maps 3-char Salesforce key prefix to a human-readable work item type.
// We only inspect the prefix — we never fetch the actual work item record.
const KEY_PREFIX_MAP: Record<string, string> = {
  "500": "Case",
  "570": "Live Chat",
  "0Mh": "Messaging Session",
  "0Oc": "Voice Call",
};

export function workItemTypeFromId(id: string): string {
  const prefix = id.substring(0, 3);
  return KEY_PREFIX_MAP[prefix] ?? "Work Item";
}

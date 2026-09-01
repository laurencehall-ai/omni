// ─── POST /api/auth/connect ────────────────────────────────────────────────────
// Starts the Salesforce OAuth 2.0 PKCE authorization flow.
//
// Flow overview:
// 1. Admin submits their Salesforce instance URL, Connected App client ID, and client secret
//    via the /connect form.
// 2. This route generates a PKCE code_verifier/code_challenge pair.
// 3. The credentials + code_verifier are saved in the session cookie (_pending).
// 4. The authorize URL is returned — the browser navigates there.
// 5. After the admin approves, Salesforce redirects to /api/auth/callback with a code.
//
// Why PKCE instead of plain client_secret flow?
// Salesforce Connected Apps with "Require Proof Key for Code Exchange (PKCE)" checked
// will reject the token exchange if client_secret is sent. PKCE uses the code_verifier
// as the secret instead, making the flow safe for public clients.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createHash, randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const { instanceUrl, clientId, clientSecret } = await req.json();

  if (!instanceUrl || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Normalize the instance URL — prepend https:// if the admin omitted it
  const raw = instanceUrl.startsWith("http")
    ? instanceUrl
    : `https://${instanceUrl}`;
  const url = new URL(raw);

  // Validate that the URL is actually a Salesforce domain before redirecting there
  const validSFDomain =
    url.hostname.endsWith(".salesforce.com") ||
    url.hostname.endsWith(".force.com") ||
    url.hostname.endsWith(".my.salesforce.com");

  if (!validSFDomain) {
    return NextResponse.json(
      { error: "Instance URL must be a Salesforce domain" },
      { status: 400 },
    );
  }

  // Generate PKCE pair:
  // code_verifier = 32 random bytes encoded as base64url (URL-safe, no padding)
  // code_challenge = SHA-256 of the verifier, also base64url-encoded
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // Store credentials and verifier in the session — needed in the callback
  const session = await getSession();
  session._pending = {
    instanceUrl: url.origin,
    clientId,
    clientSecret,
    codeVerifier,
  };
  await session.save();

  // Build the Salesforce authorize URL.
  // Note: client_secret is NOT included here — Salesforce rejects it in PKCE flows.
  const authUrl = new URL(`${url.origin}/services/oauth2/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", process.env.SF_CALLBACK_URL!);
  authUrl.searchParams.set("scope", "api refresh_token offline_access");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.json({ authUrl: authUrl.toString() });
}

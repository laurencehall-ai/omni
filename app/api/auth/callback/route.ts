// ─── GET /api/auth/callback ────────────────────────────────────────────────────
// Handles the OAuth 2.0 redirect from Salesforce after the admin approves access.
//
// Salesforce redirects here with ?code=... after approval, or ?error=... on failure.
// This route exchanges the authorization code for access + refresh tokens.
//
// PKCE token exchange: sends code_verifier instead of client_secret.
// Sending client_secret would cause "unsupported_grant_type" on PKCE-required orgs.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Salesforce sends error= if the admin denies access or if something is misconfigured
  if (error) {
    return NextResponse.redirect(new URL(`/connect?error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/connect?error=no_code", req.url));
  }

  // Retrieve the pending credentials and PKCE verifier saved during /api/auth/connect
  const session = await getSession();
  const pending = session._pending;

  if (!pending) {
    // Session expired or cookie was lost between the two requests
    return NextResponse.redirect(new URL("/connect?error=session_expired", req.url));
  }

  // Exchange the authorization code for tokens.
  // PKCE flow: send code_verifier, NOT client_secret.
  // Salesforce verifies that SHA256(code_verifier) == code_challenge sent earlier.
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: pending.clientId,
    redirect_uri: process.env.SF_CALLBACK_URL!,
    code,
    code_verifier: pending.codeVerifier,
    // client_secret intentionally omitted — PKCE Connected Apps reject it
  });

  const tokenRes = await fetch(`${pending.instanceUrl}/services/oauth2/token`, {
    method: "POST",
    body: params,
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();

    return NextResponse.redirect(new URL("/connect?error=token_exchange_failed", req.url));
  }

  const tokenData = await tokenRes.json();

  // Persist the org connection in the session cookie and clear the pending state
  session.org = {
    instanceUrl: tokenData.instance_url ?? pending.instanceUrl,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    label: "Production",
  };
  session._pending = undefined; // Clean up temporary PKCE state
  await session.save();

  // Redirect to the work items list — the user is now connected
  return NextResponse.redirect(new URL("/work-items", req.url));
}

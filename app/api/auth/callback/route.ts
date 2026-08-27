import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/connect?error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/connect?error=no_code", req.url));
  }

  const session = await getSession();
  const pending = session._pending;

  if (!pending) {
    return NextResponse.redirect(new URL("/connect?error=session_expired", req.url));
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: pending.clientId,
    client_secret: pending.clientSecret,
    redirect_uri: process.env.SF_CALLBACK_URL!,
    code,
    code_verifier: pending.codeVerifier,
  });

  const tokenRes = await fetch(`${pending.instanceUrl}/services/oauth2/token`, {
    method: "POST",
    body: params,
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("Token exchange failed:", body);
    return NextResponse.redirect(new URL("/connect?error=token_exchange_failed", req.url));
  }

  const tokenData = await tokenRes.json();

  session.org = {
    instanceUrl: tokenData.instance_url ?? pending.instanceUrl,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    label: "Production",
  };
  session._pending = undefined;
  await session.save();

  return NextResponse.redirect(new URL("/work-items", req.url));
}

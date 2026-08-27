import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createHash, randomBytes } from "crypto";

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function POST(req: NextRequest) {
  const { instanceUrl, clientId, clientSecret } = await req.json();

  if (!instanceUrl || !clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const raw = instanceUrl.startsWith("http") ? instanceUrl : `https://${instanceUrl}`;
  const url = new URL(raw);
  const validSFDomain =
    url.hostname.endsWith(".salesforce.com") ||
    url.hostname.endsWith(".force.com") ||
    url.hostname.endsWith(".my.salesforce.com");

  if (!validSFDomain) {
    return NextResponse.json({ error: "Instance URL must be a Salesforce domain" }, { status: 400 });
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const session = await getSession();
  session._pending = { instanceUrl: url.origin, clientId, clientSecret, codeVerifier };
  await session.save();

  const authUrl = new URL(`${url.origin}/services/oauth2/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", process.env.SF_CALLBACK_URL!);
  authUrl.searchParams.set("scope", "api refresh_token offline_access");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.json({ authUrl: authUrl.toString() });
}

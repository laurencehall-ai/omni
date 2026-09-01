// ─── Session management ───────────────────────────────────────────────────────
// Wraps iron-session v8 for use with Next.js 14 App Router.
// The session is stored in an encrypted httpOnly cookie — the Salesforce
// access token never touches localStorage or a database.

import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { OrgConnection } from "./types";

// Shape of data stored in the session cookie.
export interface SessionData {
  // Set after a successful OAuth callback — contains the live org connection.
  org?: OrgConnection;

  // Temporary state stored during the OAuth redirect flow.
  // Holds the credentials and PKCE verifier between the /connect POST
  // and the /api/auth/callback GET. Cleared after the token exchange succeeds.
  _pending?: {
    instanceUrl: string;
    clientId: string;
    clientSecret: string; // Stored for potential future use (e.g. token refresh)
    codeVerifier: string; // PKCE code verifier — sent to Salesforce at token exchange
  };
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET as string, // Must be 32+ chars in .env.local
  cookieName: "routecause_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod, HTTP OK in dev
    httpOnly: true, // Never exposed to browser JavaScript
  },
};

// Returns the current iron-session instance for use in API routes.
// App Router requires passing the cookies() store directly to getIronSession.
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore as never, sessionOptions);
}

// Convenience helper for API routes that require an active org connection.
// Throws a recognizable error message if no org is connected,
// which API routes catch and convert to a 401 response.
export async function getOrgOrThrow(): Promise<OrgConnection> {
  const session = await getSession();
  if (!session.org) {
    throw new Error("No org connected. Please connect a Salesforce org first.");
  }
  return session.org;
}

import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { OrgConnection } from "./types";

export interface SessionData {
  org?: OrgConnection;
  _pending?: {
    instanceUrl: string;
    clientId: string;
    clientSecret: string;
    codeVerifier: string;
  };
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "routecause_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  // iron-session v8 App Router usage: pass the cookies() store directly
  return getIronSession<SessionData>(cookieStore as never, sessionOptions);
}

export async function getOrgOrThrow(): Promise<OrgConnection> {
  const session = await getSession();
  if (!session.org) {
    throw new Error("No org connected. Please connect a Salesforce org first.");
  }
  return session.org;
}

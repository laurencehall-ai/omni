// ─── POST /api/auth/disconnect ─────────────────────────────────────────────────
// Destroys the session cookie, disconnecting the org.
// Called by the "Disconnect" button in the header/footer.
// Does not revoke the Salesforce token — the token expires naturally on the SF side.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}

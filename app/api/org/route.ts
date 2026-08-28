// ─── GET /api/org ─────────────────────────────────────────────────────────────
// Returns the current org connection status.
// Used by the header to show/hide the Connect button and display the org label.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.org) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    label: session.org.label,
    instanceUrl: session.org.instanceUrl,
  });
}

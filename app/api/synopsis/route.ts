// ─── GET /api/synopsis ────────────────────────────────────────────────────────
// Fetches the org's Omni-Channel configuration overview.
//
// Steps:
//   1. Query ServiceChannel, RoutingConfig, QueueRoutingConfig, ServicePresenceConfig,
//      Skill, and User counts (some via Tooling API)
//   2. Run narrateSynopsis() — Claude summary or deterministic fallback
//
// Returns { synopsis, narration } to the Synopsis page.
// Returns 401 if no org is connected.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getOrgSynopsis } from "@/lib/sf-synopsis";
import { narrateSynopsis } from "@/lib/claude";

export async function GET() {
  const session = await getSession();
  if (!session.org) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const synopsis = await getOrgSynopsis(session.org);
  const narration = await narrateSynopsis(synopsis);
  return NextResponse.json({ synopsis, narration });
}

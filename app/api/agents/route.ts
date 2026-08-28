// ─── GET /api/agents?q=... ────────────────────────────────────────────────────
// Typeahead endpoint for searching active Salesforce users.
// Used by CorrectionPanel's "Specific Agent" selector.
// Returns up to 20 matching users as [{ id, name }].

import { NextRequest, NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { listAgents } from "@/lib/sf-queries";

export async function GET(req: NextRequest) {
  try {
    const org = await getOrgOrThrow();
    const search = new URL(req.url).searchParams.get("q") ?? "";
    const agents = await listAgents(org, search);
    return NextResponse.json(agents);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

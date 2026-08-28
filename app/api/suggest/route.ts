// ─── POST /api/suggest ────────────────────────────────────────────────────────
// Generates a configuration suggestion for a misrouted work item.
//
// Request body: { agentWorkId: string, correction: CorrectionInput }
// The correction describes where the work item should have routed instead.
//
// Steps:
//   1. Fetch the routing trace for the given AgentWork ID
//   2. Pass the trace (customer-stripped) + correction to suggestConfiguration()
//   3. Return the ConfigSuggestion to SuggestionPanel
//
// Returns 401 if no org is connected, 500 for any other error.

import { NextRequest, NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { getRoutingTrace } from "@/lib/sf-queries";
import { suggestConfiguration } from "@/lib/claude";
import { CorrectionInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const org = await getOrgOrThrow();
    const body = await req.json();
    const { agentWorkId, correction }: { agentWorkId: string; correction: CorrectionInput } = body;

    if (!agentWorkId) return NextResponse.json({ error: "Missing agentWorkId" }, { status: 400 });

    // Re-fetch the trace here (not passed from client) to ensure we have fresh data
    // and so the client can't inject routing data
    const trace = await getRoutingTrace(org, agentWorkId);
    const suggestion = await suggestConfiguration(trace, correction);

    return NextResponse.json(suggestion);
  } catch (e) {

    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

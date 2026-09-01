// ─── GET /api/trace?id=... ────────────────────────────────────────────────────
// Fetches the full routing chain for a single AgentWork record and runs analysis.
//
// Steps:
//   1. Fetch RoutingChain from Salesforce (AgentWork + related objects)
//   2. Run analyzeChain() — deterministic leg flags
//   3. Run narrateChain() — Claude narration (or deterministic fallback)
//
// Returns { chain, narration } to the trace page.
// Returns 401 if no org is connected, 500 for any Salesforce or Claude error.

import { NextRequest, NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { getRoutingChain } from "@/lib/sf-queries";
import { analyzeChain } from "@/lib/routing-analyzer";
import { narrateChain } from "@/lib/claude";

export async function GET(req: NextRequest) {
  try {
    const org = await getOrgOrThrow();
    const id = new URL(req.url).searchParams.get("id");
    if (!id)
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 },
      );

    const chain = await getRoutingChain(org, id);
    analyzeChain(chain); // Populates leg flags in-place — no external dependency
    const narration = await narrateChain(chain); // May fall back if no API key

    return NextResponse.json({ chain, narration });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

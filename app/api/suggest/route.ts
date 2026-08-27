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

    const trace = await getRoutingTrace(org, agentWorkId);
    const suggestion = await suggestConfiguration(trace, correction);

    return NextResponse.json(suggestion);
  } catch (e) {
    console.error("Suggest error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

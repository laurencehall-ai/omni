import { NextRequest, NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { getRoutingTrace } from "@/lib/sf-queries";
import { analyzeRouting } from "@/lib/routing-analyzer";
import { narrateRouting } from "@/lib/claude";

export async function GET(req: NextRequest) {
  try {
    const org = await getOrgOrThrow();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });

    const trace = await getRoutingTrace(org, id);
    const explanation = analyzeRouting(trace);
    const narration = await narrateRouting(trace, explanation);

    return NextResponse.json({ trace, explanation, narration });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

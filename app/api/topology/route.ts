import { NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { getTopologyGraph } from "@/lib/sf-topology";

export async function GET() {
  try {
    const org = await getOrgOrThrow();
    const graph = await getTopologyGraph(org);
    return NextResponse.json(graph);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── GET /api/work-items ──────────────────────────────────────────────────────
// Returns a paginated list of recent AgentWork records.
//
// Query parameters:
//   days       — how many days back to look (default: 7)
//   channelId  — filter to a specific service channel
//   queueId    — filter to a specific queue
//   agentId    — filter to a specific agent
//
// Returns an array of WorkItemRow objects enriched with customer info and queue names.
// Returns 401 if no org is connected, 500 for any other error.

import { NextRequest, NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { listWorkItems } from "@/lib/sf-queries";

export async function GET(req: NextRequest) {
  try {
    const org = await getOrgOrThrow();
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") ?? "7", 10);

    const items = await listWorkItems(org, days, {
      channelId: searchParams.get("channelId") ?? undefined,
      queueId: searchParams.get("queueId") ?? undefined,
      agentId: searchParams.get("agentId") ?? undefined,
    });

    return NextResponse.json(items);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

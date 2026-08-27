import { NextRequest, NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { listQueues } from "@/lib/sf-queries";

export async function GET(req: NextRequest) {
  try {
    const org = await getOrgOrThrow();
    const search = new URL(req.url).searchParams.get("q") ?? "";
    const queues = await listQueues(org, search);
    return NextResponse.json(queues);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

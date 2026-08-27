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

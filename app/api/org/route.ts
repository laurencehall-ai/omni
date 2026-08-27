import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.org) return NextResponse.json({ connected: false });
  return NextResponse.json({ connected: true, label: session.org.label, instanceUrl: session.org.instanceUrl });
}

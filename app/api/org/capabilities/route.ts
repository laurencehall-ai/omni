import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sfQuery } from "@/lib/salesforce";

export async function GET() {
  const session = await getSession();
  if (!session.org) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  let skillsEnabled = false;
  try {
    const rows = await sfQuery<{ Id: string }>(session.org, "SELECT Id FROM Skill LIMIT 1");
    skillsEnabled = rows.length > 0;
  } catch {
    // Skill object not accessible in this org — skills-based routing not configured
    skillsEnabled = false;
  }

  return NextResponse.json({ skillsEnabled });
}

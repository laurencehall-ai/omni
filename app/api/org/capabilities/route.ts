// ─── GET /api/org/capabilities ────────────────────────────────────────────────
// Returns which optional Omni-Channel features are configured in the connected org.
// Currently checks for skills-based routing.
//
// Used by CorrectionPanel to decide whether to show the "Skills-based" tab —
// there's no point showing it if the org has no skills configured.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sfQuery } from "@/lib/salesforce";

export async function GET() {
  const session = await getSession();
  if (!session.org) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  // Check if the org has any Skill records — if none exist, skills-based routing is not in use.
  // We only need one record to confirm presence, hence LIMIT 1.
  let skillsEnabled = false;
  try {
    const rows = await sfQuery<{ Id: string }>(session.org, "SELECT Id FROM Skill LIMIT 1");
    skillsEnabled = rows.length > 0;
  } catch {
    // Skill object not accessible in this org — treat as not configured
    skillsEnabled = false;
  }

  return NextResponse.json({ skillsEnabled });
}

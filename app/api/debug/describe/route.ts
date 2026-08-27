import { NextRequest, NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";

const API_VERSION = "v62.0";

export async function GET(req: NextRequest) {
  const obj = new URL(req.url).searchParams.get("obj") ?? "AgentWork";
  const org = await getOrgOrThrow();
  const res = await fetch(
    `${org.instanceUrl}/services/data/${API_VERSION}/sobjects/${obj}/describe`,
    { headers: { Authorization: `Bearer ${org.accessToken}` }, cache: "no-store" }
  );
  const data = await res.json();
  const fields = (data.fields ?? []).map((f: { name: string; type: string; relationshipName: string | null }) => ({
    name: f.name,
    type: f.type,
    relationshipName: f.relationshipName,
  }));
  return NextResponse.json(fields);
}

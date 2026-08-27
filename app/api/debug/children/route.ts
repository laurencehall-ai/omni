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
  const children = (data.childRelationships ?? []).map((r: { childSObject: string; relationshipName: string | null; field: string }) => ({
    childSObject: r.childSObject,
    relationshipName: r.relationshipName,
    field: r.field,
  }));
  return NextResponse.json(children);
}

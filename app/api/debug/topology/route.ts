import { NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { sfQuery, sfToolingQuery } from "@/lib/salesforce";
import { OrgConnection } from "@/lib/types";

interface ProbeResult {
  name: string;
  soql: string;
  tooling: boolean;
  ok: boolean;
  count?: number;
  sample?: unknown[];
  error?: string;
}

async function probe(
  org: OrgConnection,
  name: string,
  soql: string,
  tooling = false,
): Promise<ProbeResult> {
  try {
    const records = tooling
      ? await sfToolingQuery<unknown>(org, soql)
      : await sfQuery<unknown>(org, soql);
    return { name, soql, tooling, ok: true, count: records.length, sample: records.slice(0, 2) };
  } catch (e) {
    return { name, soql, tooling, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function describeObject(org: OrgConnection, objectName: string, tooling = false) {
  const base = `${org.instanceUrl}/services/data/v62.0`;
  const path = tooling
    ? `${base}/tooling/sobjects/${objectName}/describe`
    : `${base}/sobjects/${objectName}/describe`;
  try {
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${org.accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      return { object: objectName, ok: false, error: `${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json() as { fields: Array<{ name: string; type: string; referenceTo: string[] }> };
    const fields = data.fields.map((f) => `${f.name} (${f.type}${f.referenceTo?.length ? " → " + f.referenceTo.join(",") : ""})`);
    return { object: objectName, ok: true, fieldCount: fields.length, fields };
  } catch (e) {
    return { object: objectName, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  try {
    const org = await getOrgOrThrow();

    const [probes, scDescribe, qrcDescribe] = await Promise.all([
      Promise.all([
        probe(org, "ServiceChannel (minimal)",
          "SELECT Id, MasterLabel, RelatedEntity, ChannelType FROM ServiceChannel LIMIT 3"),
        probe(org, "GroupMember users only",
          "SELECT GroupId, UserOrGroupId FROM GroupMember WHERE Group.Type = 'Queue' LIMIT 10"),
        probe(org, "Flow RoutingFlow (Tooling)",
          "SELECT Id, DefinitionId, VersionNumber FROM Flow WHERE ProcessType = 'RoutingFlow' AND Status = 'Active' ORDER BY DefinitionId, VersionNumber DESC LIMIT 10", true),
        probe(org, "QueueRoutingConfig exists",
          "SELECT Id FROM QueueRoutingConfig LIMIT 1"),
      ]),
      describeObject(org, "ServiceChannel"),
      describeObject(org, "QueueRoutingConfig"),
    ]);

    return NextResponse.json({ probes, describes: { ServiceChannel: scDescribe, QueueRoutingConfig: qrcDescribe } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

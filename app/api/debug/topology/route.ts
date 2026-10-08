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

    const [probes, groupDescribe, serviceResourceDescribe] = await Promise.all([
      Promise.all([
        // ServiceChannel without the bad fields
        probe(org, "ServiceChannel",
          "SELECT Id, MasterLabel, RelatedEntity FROM ServiceChannel LIMIT 3"),
        // QueueRoutingConfig as the routing config object itself
        probe(org, "QueueRoutingConfig (as RoutingConfig)",
          "SELECT Id, MasterLabel, DeveloperName, RoutingModel, CapacityWeight, IsAttributeBased FROM QueueRoutingConfig LIMIT 5"),
        // Group with a routing config reference field (if it exists)
        probe(org, "Group with QueueRoutingConfigId",
          "SELECT Id, Name, QueueRoutingConfigId FROM Group WHERE Type = 'Queue' LIMIT 5"),
        // ServiceResource as the agent source (instead of GroupMember)
        probe(org, "ServiceResource agents",
          "SELECT Id, Name, RelatedRecordId FROM ServiceResource WHERE ResourceType = 'T' AND IsActive = true LIMIT 5"),
        // ServiceResource → Queue via AgentWork (if any field exists)
        probe(org, "ServiceResource queues",
          "SELECT Id, Name, RelatedRecordId, QueueId FROM ServiceResource WHERE ResourceType = 'T' AND IsActive = true LIMIT 3"),
      ]),
      describeObject(org, "Group"),
      describeObject(org, "ServiceResource"),
    ]);

    // Filter Group describe to just reference fields for readability
    const groupRefFields = groupDescribe.ok
      ? (groupDescribe.fields as string[]).filter(f => f.includes("reference") || f.toLowerCase().includes("routing") || f.toLowerCase().includes("queue"))
      : [];

    const srRefFields = serviceResourceDescribe.ok
      ? (serviceResourceDescribe.fields as string[]).filter(f => f.includes("reference") || f.toLowerCase().includes("routing") || f.toLowerCase().includes("queue"))
      : [];

    return NextResponse.json({
      probes,
      groupReferenceFields: groupRefFields,
      serviceResourceReferenceFields: srRefFields,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

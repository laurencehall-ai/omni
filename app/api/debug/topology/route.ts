import { NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { sfQuery, sfToolingQuery } from "@/lib/salesforce";

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
  org: Parameters<typeof sfQuery>[0],
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

export async function GET() {
  try {
    const org = await getOrgOrThrow();

    const results = await Promise.all([
      probe(org, "ServiceChannel",
        "SELECT Id, MasterLabel, RelatedEntity, RoutingConfigurationId, ChannelType FROM ServiceChannel LIMIT 5"),
      probe(org, "RoutingConfiguration (REST)",
        "SELECT Id, Name, RoutingModel FROM RoutingConfiguration LIMIT 5"),
      probe(org, "RoutingConfiguration (Tooling)",
        "SELECT Id, Name, RoutingModel FROM RoutingConfiguration LIMIT 5", true),
      probe(org, "GroupMember",
        "SELECT GroupId, UserOrGroupId, UserOrGroup.Name FROM GroupMember WHERE Group.Type = 'Queue' LIMIT 5"),
      probe(org, "FlowDefinition (Tooling)",
        "SELECT Id, DeveloperName, MasterLabel FROM FlowDefinition LIMIT 5", true),
      probe(org, "Flow RoutingFlow (Tooling)",
        "SELECT Id, DefinitionId, VersionNumber FROM Flow WHERE ProcessType = 'RoutingFlow' AND Status = 'Active' LIMIT 5", true),
      probe(org, "ServiceResourceSkill",
        "SELECT ServiceResourceId, ServiceResource.RelatedRecordId, SkillId FROM ServiceResourceSkill WHERE ServiceResource.ResourceType = 'T' LIMIT 5"),
      probe(org, "QueueRoutingConfig (REST)",
        "SELECT Id, QueueId, RoutingConfigId FROM QueueRoutingConfig LIMIT 5"),
      probe(org, "QueueRoutingConfig (Tooling)",
        "SELECT Id, QueueId, RoutingConfigId FROM QueueRoutingConfig LIMIT 5", true),
    ]);

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

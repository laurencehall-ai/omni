import { sfQuery, sfToolingQuery, sfToolingGet } from "./salesforce";
import { OrgConnection } from "./types";
import { FlowRecord, FlowInputParameter } from "./flow-types";
import { TopologyGraph, TopologyNode, TopologyEdge, TopologyColumnId } from "./topology-types";

// ─── Raw Salesforce record shapes ─────────────────────────────────────────────

interface RawServiceChannel {
  Id: string;
  MasterLabel: string;
  RelatedEntity: string | null;
  RoutingConfigId: string | null;
  ChannelType: string | null;
}

interface RawRoutingConfig {
  Id: string;
  Name: string;
  RoutingModel: string | null;
  IsAttributeBasedRouting: boolean | null;
  CapacityWeight: number | null;
}

interface RawQueueRoutingConfig {
  Id: string;
  QueueId: string;
  RoutingConfigId: string;
}

interface RawQueueSobject {
  QueueId: string;
  SobjectType: string;
}

interface RawGroup {
  Id: string;
  Name: string;
}

interface RawGroupMember {
  GroupId: string;
  UserOrGroupId: string;
  UserOrGroup: { Name: string } | null;
}

interface RawServiceResourceSkill {
  ServiceResourceId: string;
  ServiceResource: {
    RelatedRecordId: string;
    RelatedRecord: { Name: string } | null;
  } | null;
  SkillId: string;
  Skill: { MasterLabel: string } | null;
}

interface RawSkillRequirement {
  RelatedRecordId: string;
  SkillId: string;
  Skill: { MasterLabel: string } | null;
}

interface RawSkill {
  Id: string;
  MasterLabel: string;
}

interface RawFlowDef {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
}

// ─── tryQuery ─────────────────────────────────────────────────────────────────

type QueryResult<T> = { ok: true; records: T[] } | { ok: false; object: string };

async function tryQuery<T>(
  org: OrgConnection,
  objectName: string,
  soql: string,
  tooling = false,
): Promise<QueryResult<T>> {
  try {
    const records = tooling
      ? await sfToolingQuery<T>(org, soql)
      : await sfQuery<T>(org, soql);
    return { ok: true, records };
  } catch {
    return { ok: false, object: objectName };
  }
}

// ─── Helper: extract inputParameter value ─────────────────────────────────────

function getParam(params: FlowInputParameter[], name: string): string | null {
  const p = params.find((x) => x.name === name);
  if (!p?.value) return null;
  return p.value.stringValue ?? p.value.setupReference ?? null;
}

// ─── getTopologyGraph ──────────────────────────────────────────────────────────

export async function getTopologyGraph(org: OrgConnection): Promise<TopologyGraph> {
  const unavailableObjects: string[] = [];

  // Fire all base queries in parallel
  const [
    channelRes,
    routingConfigRes,
    queueRoutingConfigRes,
    queueSobjectRes,
    groupRes,
    groupMemberRes,
    serviceResourceSkillRes,
    skillRequirementRes,
    skillRes,
    flowDefRes,
  ] = await Promise.all([
    tryQuery<RawServiceChannel>(
      org, "ServiceChannel",
      "SELECT Id, MasterLabel, RelatedEntity, RoutingConfigId, ChannelType FROM ServiceChannel LIMIT 100",
    ),
    tryQuery<RawRoutingConfig>(
      org, "RoutingConfiguration",
      "SELECT Id, Name, RoutingModel, IsAttributeBasedRouting, CapacityWeight FROM RoutingConfiguration LIMIT 100",
    ),
    tryQuery<RawQueueRoutingConfig>(
      org, "QueueRoutingConfig",
      "SELECT Id, QueueId, RoutingConfigId FROM QueueRoutingConfig WHERE IsActive = true LIMIT 200",
    ),
    tryQuery<RawQueueSobject>(
      org, "QueueSobject",
      "SELECT QueueId, SobjectType FROM QueueSobject WHERE Queue.Type = 'Queue' LIMIT 500",
    ),
    tryQuery<RawGroup>(
      org, "Queue (Group)",
      "SELECT Id, Name FROM Group WHERE Type = 'Queue' LIMIT 200",
    ),
    tryQuery<RawGroupMember>(
      org, "GroupMember",
      "SELECT GroupId, UserOrGroupId, UserOrGroup.Name FROM GroupMember WHERE Group.Type = 'Queue' AND UserOrGroup.Type = 'User' LIMIT 1000",
    ),
    tryQuery<RawServiceResourceSkill>(
      org, "ServiceResourceSkill",
      "SELECT ServiceResourceId, ServiceResource.RelatedRecordId, ServiceResource.RelatedRecord.Name, SkillId, Skill.MasterLabel FROM ServiceResourceSkill WHERE ServiceResource.ResourceType = 'T' AND ServiceResource.IsActive = true LIMIT 500",
    ),
    tryQuery<RawSkillRequirement>(
      org, "SkillRequirement",
      "SELECT RelatedRecordId, SkillId, Skill.MasterLabel FROM SkillRequirement LIMIT 500",
    ),
    tryQuery<RawSkill>(
      org, "Skill",
      "SELECT Id, MasterLabel FROM Skill LIMIT 100",
    ),
    tryQuery<RawFlowDef>(
      org, "FlowDefinition (RoutingFlow)",
      "SELECT Id, DeveloperName, MasterLabel FROM FlowDefinition WHERE ProcessType = 'RoutingFlow' LIMIT 100",
      true, // Tooling API
    ),
  ]);

  // Track unavailable objects
  for (const r of [channelRes, routingConfigRes, queueRoutingConfigRes, queueSobjectRes,
    groupRes, groupMemberRes, serviceResourceSkillRes, skillRequirementRes, skillRes, flowDefRes]) {
    if (!r.ok) unavailableObjects.push(r.object);
  }

  // ─── Build node maps ──────────────────────────────────────────────────────

  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];

  function addNode(node: TopologyNode) {
    if (!nodes.find((n) => n.id === node.id)) nodes.push(node);
  }

  function addEdge(from: string, to: string, fromColumn: TopologyColumnId, toColumn: TopologyColumnId) {
    const key = `${from}→${to}`;
    if (!edges.find((e) => e.from === from && e.to === to)) {
      edges.push({ from, to, fromColumn, toColumn });
    }
    void key;
  }

  // Service Channels
  const channels = channelRes.ok ? channelRes.records : [];
  for (const ch of channels) {
    addNode({ id: ch.Id, label: ch.MasterLabel, columnId: "channel", meta: { channelType: ch.ChannelType } });
  }

  // Routing Configurations
  const routingConfigs = routingConfigRes.ok ? routingConfigRes.records : [];
  const routingConfigIds = new Set(routingConfigs.map((r) => r.Id));
  for (const rc of routingConfigs) {
    addNode({ id: rc.Id, label: rc.Name, columnId: "routingConfig", meta: { routingModel: rc.RoutingModel, skillsBased: rc.IsAttributeBasedRouting } });
  }

  // ServiceChannel → RoutingConfig edges
  for (const ch of channels) {
    if (ch.RoutingConfigId) addEdge(ch.Id, ch.RoutingConfigId, "channel", "routingConfig");
  }

  // Queues
  const groups = groupRes.ok ? groupRes.records : [];
  for (const g of groups) {
    addNode({ id: g.Id, label: g.Name, columnId: "queue" });
  }

  // Queue → RoutingConfig edges (via QueueRoutingConfig)
  const queueRoutingConfigs = queueRoutingConfigRes.ok ? queueRoutingConfigRes.records : [];
  for (const qrc of queueRoutingConfigs) {
    if (qrc.QueueId && qrc.RoutingConfigId) {
      addNode({ id: qrc.QueueId, label: qrc.QueueId, columnId: "queue" }); // ensure node exists
      addEdge(qrc.QueueId, qrc.RoutingConfigId, "queue", "routingConfig");
    }
  }

  // Queue → Object edges (via QueueSobject)
  const queueSobjects = queueSobjectRes.ok ? queueSobjectRes.records : [];
  const objectLabels = new Map<string, string>([
    ["Case", "Case"],
    ["Lead", "Lead"],
    ["VoiceCall", "Voice Call"],
    ["MessagingSession", "Messaging Session"],
    ["LiveChatTranscript", "Live Chat"],
    ["ContactRequest", "Contact Request"],
    ["SocialPost", "Social Post"],
  ]);
  for (const qs of queueSobjects) {
    if (!qs.QueueId || !qs.SobjectType) continue;
    const objId = `obj_${qs.SobjectType}`;
    addNode({ id: objId, label: objectLabels.get(qs.SobjectType) ?? qs.SobjectType, columnId: "object" });
    addEdge(qs.QueueId, objId, "queue", "object");
  }

  // ServiceChannel → Object edges (via RelatedEntity)
  for (const ch of channels) {
    if (ch.RelatedEntity) {
      const objId = `obj_${ch.RelatedEntity}`;
      addNode({ id: objId, label: objectLabels.get(ch.RelatedEntity) ?? ch.RelatedEntity, columnId: "object" });
      addEdge(ch.Id, objId, "channel", "object");
    }
  }

  // Agents (deduplicated by UserId)
  const agentUserIds = new Map<string, string>(); // userId → name
  const groupMembers = groupMemberRes.ok ? groupMemberRes.records : [];
  for (const gm of groupMembers) {
    if (gm.UserOrGroup?.Name) agentUserIds.set(gm.UserOrGroupId, gm.UserOrGroup.Name);
  }
  for (const [userId, name] of Array.from(agentUserIds.entries())) {
    addNode({ id: `agent_${userId}`, label: name, columnId: "agent" });
  }

  // Agent → Queue edges
  for (const gm of groupMembers) {
    const agentNodeId = `agent_${gm.UserOrGroupId}`;
    if (agentUserIds.has(gm.UserOrGroupId)) {
      addEdge(agentNodeId, gm.GroupId, "agent", "queue");
    }
  }

  // Skills
  const skills = skillRes.ok ? skillRes.records : [];
  for (const s of skills) {
    addNode({ id: `skill_${s.Id}`, label: s.MasterLabel, columnId: "skill" });
  }

  // Agent → Skill edges (via ServiceResourceSkill)
  const serviceResourceSkills = serviceResourceSkillRes.ok ? serviceResourceSkillRes.records : [];
  for (const srs of serviceResourceSkills) {
    if (!srs.ServiceResource?.RelatedRecordId) continue;
    const userId = srs.ServiceResource.RelatedRecordId;
    const agentNodeId = `agent_${userId}`;
    const skillNodeId = `skill_${srs.SkillId}`;
    if (agentUserIds.has(userId)) {
      addNode({ id: skillNodeId, label: srs.Skill?.MasterLabel ?? srs.SkillId, columnId: "skill" });
      addEdge(agentNodeId, skillNodeId, "agent", "skill");
    }
  }

  // Skill → RoutingConfig edges (via SkillRequirement)
  const skillRequirements = skillRequirementRes.ok ? skillRequirementRes.records : [];
  for (const sr of skillRequirements) {
    if (!sr.RelatedRecordId || !sr.SkillId) continue;
    if (!routingConfigIds.has(sr.RelatedRecordId)) continue; // filter to RoutingConfig rows only
    const skillNodeId = `skill_${sr.SkillId}`;
    addNode({ id: skillNodeId, label: sr.Skill?.MasterLabel ?? sr.SkillId, columnId: "skill" });
    addEdge(skillNodeId, sr.RelatedRecordId, "skill", "routingConfig");
  }

  // Omni-Channel Flows + Flow → Queue edges
  const flowDefs = flowDefRes.ok ? flowDefRes.records : [];
  const flowsToFetch = flowDefs.slice(0, 20); // perf guard

  // Fetch latest active version ID for each flow definition
  type FlowVersionRow = { Id: string; DefinitionId: string; VersionNumber: number };
  let flowVersions: FlowVersionRow[] = [];
  if (flowsToFetch.length > 0) {
    const defIds = flowsToFetch.map((f) => `'${f.Id}'`).join(",");
    const versionRes = await tryQuery<FlowVersionRow>(
      org, "Flow version",
      `SELECT Id, DefinitionId, VersionNumber FROM Flow WHERE ProcessType = 'RoutingFlow' AND Status = 'Active' AND DefinitionId IN (${defIds}) ORDER BY DefinitionId, VersionNumber DESC LIMIT 100`,
      true,
    );
    if (versionRes.ok) {
      // Dedupe to latest per DefinitionId
      const seen = new Set<string>();
      flowVersions = versionRes.records.filter((v) => {
        if (seen.has(v.DefinitionId)) return false;
        seen.add(v.DefinitionId);
        return true;
      });
    }
  }

  // Map definitionId → label
  const flowDefLabels = new Map(flowDefs.map((f) => [f.Id, f.MasterLabel || f.DeveloperName]));

  for (const version of flowVersions) {
    const flowLabel = flowDefLabels.get(version.DefinitionId) ?? version.DefinitionId;
    const flowNodeId = `flow_${version.DefinitionId}`;
    addNode({ id: flowNodeId, label: flowLabel, columnId: "flow" });

    try {
      const flowRecord = await sfToolingGet<FlowRecord>(org, `/sobjects/Flow/${version.Id}`, 3600);
      if (!flowRecord.Metadata?.actionCalls) continue;
      for (const ac of flowRecord.Metadata.actionCalls) {
        if (ac.actionType !== "routeWork") continue;
        const queueId = getParam(ac.inputParameters, "queueId");
        if (queueId) {
          addEdge(flowNodeId, queueId, "flow", "queue");
        }
      }
    } catch {
      // skip flows that can't be fetched
    }
  }

  return { nodes, edges, unavailableObjects };
}

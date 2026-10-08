import { sfQuery, sfToolingQuery, sfToolingGet } from "./salesforce";
import { OrgConnection } from "./types";
import { FlowRecord, FlowInputParameter } from "./flow-types";
import { TopologyGraph, TopologyNode, TopologyEdge, TopologyColumnId } from "./topology-types";

// ─── Raw Salesforce record shapes ─────────────────────────────────────────────

interface RawServiceChannel {
  Id: string;
  MasterLabel: string;
  RelatedEntity: string | null;
}

interface RawQueueRoutingConfig {
  Id: string;
  MasterLabel: string;
  DeveloperName: string;
  RoutingModel: string | null;
  CapacityWeight: number | null;
  IsAttributeBased: boolean | null;
}

interface RawGroup {
  Id: string;
  Name: string;
  QueueRoutingConfigId: string | null;
}

interface RawGroupMember {
  GroupId: string;
  UserOrGroupId: string;
}

interface RawServiceResource {
  Id: string;
  Name: string;
  RelatedRecordId: string;
}

interface RawServiceResourceSkill {
  ServiceResourceId: string;
  ServiceResource: { RelatedRecordId: string } | null;
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

interface RawQueueSobject {
  QueueId: string;
  SobjectType: string;
}

interface RawFlowVersion {
  Id: string;
  DefinitionId: string;
  VersionNumber: number;
  MasterLabel: string | null;
}

// ─── tryQuery ─────────────────────────────────────────────────────────────────

type QueryResult<T> = { ok: true; records: T[] } | { ok: false; object: string; error: string };

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
  } catch (e) {
    return { ok: false, object: objectName, error: e instanceof Error ? e.message : String(e) };
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

  const [
    channelRes,
    queueRoutingConfigRes,
    groupRes,
    groupMemberRes,
    serviceResourceRes,
    serviceResourceSkillRes,
    skillRequirementRes,
    skillRes,
    queueSobjectRes,
    flowVersionRes,
  ] = await Promise.all([
    tryQuery<RawServiceChannel>(
      org, "ServiceChannel",
      "SELECT Id, MasterLabel, RelatedEntity FROM ServiceChannel LIMIT 100",
    ),
    // QueueRoutingConfig IS the routing configuration object in this org
    tryQuery<RawQueueRoutingConfig>(
      org, "QueueRoutingConfig",
      "SELECT Id, MasterLabel, DeveloperName, RoutingModel, CapacityWeight, IsAttributeBased FROM QueueRoutingConfig LIMIT 100",
    ),
    // Group carries QueueRoutingConfigId — the Queue → RoutingConfig link
    tryQuery<RawGroup>(
      org, "Queue",
      "SELECT Id, Name, QueueRoutingConfigId FROM Group WHERE Type = 'Queue' LIMIT 200",
    ),
    tryQuery<RawGroupMember>(
      org, "GroupMember",
      "SELECT GroupId, UserOrGroupId FROM GroupMember WHERE Group.Type = 'Queue' LIMIT 2000",
    ),
    // ServiceResource is the correct agent source (not GroupMember)
    tryQuery<RawServiceResource>(
      org, "ServiceResource",
      "SELECT Id, Name, RelatedRecordId FROM ServiceResource WHERE ResourceType = 'T' AND IsActive = true LIMIT 200",
    ),
    tryQuery<RawServiceResourceSkill>(
      org, "ServiceResourceSkill",
      "SELECT ServiceResourceId, ServiceResource.RelatedRecordId, SkillId, Skill.MasterLabel FROM ServiceResourceSkill WHERE ServiceResource.ResourceType = 'T' AND ServiceResource.IsActive = true LIMIT 500",
    ),
    tryQuery<RawSkillRequirement>(
      org, "SkillRequirement",
      "SELECT RelatedRecordId, SkillId, Skill.MasterLabel FROM SkillRequirement LIMIT 500",
    ),
    tryQuery<RawSkill>(
      org, "Skill",
      "SELECT Id, MasterLabel FROM Skill LIMIT 100",
    ),
    tryQuery<RawQueueSobject>(
      org, "QueueSobject",
      "SELECT QueueId, SobjectType FROM QueueSobject WHERE Queue.Type = 'Queue' LIMIT 500",
    ),
    // Query Flow directly with ProcessType filter — MasterLabel and ProcessType live on Flow, not FlowDefinition
    tryQuery<RawFlowVersion>(
      org, "Flow (RoutingFlow)",
      "SELECT Id, DefinitionId, VersionNumber, MasterLabel FROM Flow WHERE ProcessType = 'RoutingFlow' AND Status = 'Active' ORDER BY DefinitionId, VersionNumber DESC LIMIT 100",
      true,
    ),
  ]);

  for (const r of [channelRes, queueRoutingConfigRes, groupRes, groupMemberRes,
    serviceResourceRes, serviceResourceSkillRes, skillRequirementRes, skillRes,
    queueSobjectRes, flowVersionRes]) {
    if (!r.ok) unavailableObjects.push(`${r.object}: ${r.error}`);
  }

  // ─── Build nodes and edges ────────────────────────────────────────────────

  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];

  function addNode(node: TopologyNode) {
    if (!nodes.find((n) => n.id === node.id)) nodes.push(node);
  }

  function addEdge(from: string, to: string, fromColumn: TopologyColumnId, toColumn: TopologyColumnId) {
    if (!edges.find((e) => e.from === from && e.to === to)) {
      edges.push({ from, to, fromColumn, toColumn });
    }
  }

  // ── Service Channels ──────────────────────────────────────────────────────
  const channels = channelRes.ok ? channelRes.records : [];
  for (const ch of channels) {
    addNode({ id: ch.Id, label: ch.MasterLabel, columnId: "channel" });
  }

  // ── Routing Configs (QueueRoutingConfig) ──────────────────────────────────
  const queueRoutingConfigs = queueRoutingConfigRes.ok ? queueRoutingConfigRes.records : [];
  const routingConfigIds = new Set(queueRoutingConfigs.map((r) => r.Id));
  for (const qrc of queueRoutingConfigs) {
    addNode({
      id: qrc.Id,
      label: qrc.MasterLabel || qrc.DeveloperName,
      columnId: "routingConfig",
      meta: { routingModel: qrc.RoutingModel, skillsBased: qrc.IsAttributeBased, capacityWeight: qrc.CapacityWeight },
    });
  }

  // ── Queues — Group.QueueRoutingConfigId links queue → routing config ───────
  const groups = groupRes.ok ? groupRes.records : [];
  for (const g of groups) {
    addNode({ id: g.Id, label: g.Name, columnId: "queue" });
    if (g.QueueRoutingConfigId) {
      addEdge(g.Id, g.QueueRoutingConfigId, "queue", "routingConfig");
    }
  }

  // ── Queue → Object (via QueueSobject) ─────────────────────────────────────
  const objectLabels = new Map<string, string>([
    ["Case", "Case"], ["Lead", "Lead"], ["VoiceCall", "Voice Call"],
    ["MessagingSession", "Messaging Session"], ["LiveChatTranscript", "Live Chat"],
    ["ContactRequest", "Contact Request"], ["SocialPost", "Social Post"],
    ["SOSSession", "SOS"], ["ChatTranscript", "Chat"],
  ]);
  const queueSobjects = queueSobjectRes.ok ? queueSobjectRes.records : [];
  for (const qs of queueSobjects) {
    if (!qs.QueueId || !qs.SobjectType) continue;
    const objId = `obj_${qs.SobjectType}`;
    addNode({ id: objId, label: objectLabels.get(qs.SobjectType) ?? qs.SobjectType, columnId: "object" });
    addEdge(qs.QueueId, objId, "queue", "object");
  }

  // ── ServiceChannel → Object (via RelatedEntity) ───────────────────────────
  for (const ch of channels) {
    if (ch.RelatedEntity) {
      const objId = `obj_${ch.RelatedEntity}`;
      addNode({ id: objId, label: objectLabels.get(ch.RelatedEntity) ?? ch.RelatedEntity, columnId: "object" });
      addEdge(ch.Id, objId, "channel", "object");
    }
  }

  // ── Agents (ServiceResource, ResourceType = 'T') ──────────────────────────
  const serviceResources = serviceResourceRes.ok ? serviceResourceRes.records : [];
  // Map UserId → agent node id for joining GroupMember and ServiceResourceSkill
  const userIdToAgentNodeId = new Map<string, string>();
  for (const sr of serviceResources) {
    const nodeId = `agent_${sr.Id}`;
    userIdToAgentNodeId.set(sr.RelatedRecordId, nodeId);
    addNode({ id: nodeId, label: sr.Name, columnId: "agent" });
  }

  // ── Agent → Queue (GroupMember joined to ServiceResource via UserId) ───────
  const groupMembers = groupMemberRes.ok ? groupMemberRes.records : [];
  for (const gm of groupMembers) {
    const agentNodeId = userIdToAgentNodeId.get(gm.UserOrGroupId);
    if (agentNodeId) {
      addEdge(agentNodeId, gm.GroupId, "agent", "queue");
    }
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  const skills = skillRes.ok ? skillRes.records : [];
  for (const s of skills) {
    addNode({ id: `skill_${s.Id}`, label: s.MasterLabel, columnId: "skill" });
  }

  // ── Agent → Skill (ServiceResourceSkill) ─────────────────────────────────
  const serviceResourceSkills = serviceResourceSkillRes.ok ? serviceResourceSkillRes.records : [];
  for (const srs of serviceResourceSkills) {
    if (!srs.ServiceResource?.RelatedRecordId) continue;
    const agentNodeId = userIdToAgentNodeId.get(srs.ServiceResource.RelatedRecordId);
    if (agentNodeId) {
      const skillNodeId = `skill_${srs.SkillId}`;
      addNode({ id: skillNodeId, label: srs.Skill?.MasterLabel ?? srs.SkillId, columnId: "skill" });
      addEdge(agentNodeId, skillNodeId, "agent", "skill");
    }
  }

  // ── Skill → RoutingConfig (SkillRequirement, filtered to QueueRoutingConfig IDs) ──
  const skillRequirements = skillRequirementRes.ok ? skillRequirementRes.records : [];
  for (const sr of skillRequirements) {
    if (!sr.RelatedRecordId || !sr.SkillId) continue;
    if (!routingConfigIds.has(sr.RelatedRecordId)) continue;
    const skillNodeId = `skill_${sr.SkillId}`;
    addNode({ id: skillNodeId, label: sr.Skill?.MasterLabel ?? sr.SkillId, columnId: "skill" });
    addEdge(skillNodeId, sr.RelatedRecordId, "skill", "routingConfig");
  }

  // ── Flows (RoutingFlow, latest active version per definition) ─────────────
  const flowVersions = flowVersionRes.ok ? flowVersionRes.records : [];
  const seenDefs = new Set<string>();
  const latestVersions = flowVersions.filter((v) => {
    if (seenDefs.has(v.DefinitionId)) return false;
    seenDefs.add(v.DefinitionId);
    return true;
  }).slice(0, 20); // perf cap — flow body fetches are sequential

  for (const version of latestVersions) {
    const flowNodeId = `flow_${version.DefinitionId}`;
    addNode({ id: flowNodeId, label: version.MasterLabel || version.DefinitionId, columnId: "flow" });

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
      // skip flows whose body can't be fetched
    }
  }

  return { nodes, edges, unavailableObjects };
}

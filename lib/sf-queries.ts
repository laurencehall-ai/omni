import { sfQuery, workItemTypeFromId } from "./salesforce";
import { OrgConnection, WorkItemRow, RoutingTrace } from "./types";

interface RawAgentWork {
  Id: string;
  WorkItemId: string;
  RoutingModel: string;
  RoutingType: string | null;
  RoutingPriority: number | null;
  Status: string;
  CapacityWeight: number | null;
  CapacityPercentage: number | null;
  CreatedDate: string;
  AcceptDateTime: string | null;
  SpeedToAnswer: number | null;
  OriginalQueueId: string | null;
  ServiceChannel: { MasterLabel: string } | null;
  User: { Name: string; Username: string } | null;
}

interface RawGroup { Id: string; Name: string }

function normalizeAgentName(name: string | null | undefined): string {
  if (!name) return "Unassigned";
  if (name === "Automated Process") return "Automated Process (Flow/Bot)";
  return name;
}

function inferRoutingModel(routingType: string | null): string {
  if (!routingType) return "Standard";
  if (routingType === "ExternalRouting") return "ExternalRouting";
  if (routingType === "SkillsBased") return "SkillsBased";
  return "Standard";
}

function calcTimeToAccept(created: string, accepted: string | null): number | null {
  if (!accepted) return null;
  return Math.round((new Date(accepted).getTime() - new Date(created).getTime()) / 1000);
}

async function resolveQueueNames(
  org: OrgConnection,
  queueIds: string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(queueIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const ids = unique.map((id) => `'${id}'`).join(",");
  const records = await sfQuery<RawGroup>(org, `SELECT Id, Name FROM Group WHERE Id IN (${ids})`);
  return new Map(records.map((r) => [r.Id, r.Name]));
}

export async function listWorkItems(
  org: OrgConnection,
  days: number = 7,
  filters: { channelId?: string; queueId?: string; agentId?: string } = {}
): Promise<WorkItemRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let whereClause = `CreatedDate >= ${since}`;
  if (filters.channelId) whereClause += ` AND ServiceChannelId = '${filters.channelId}'`;
  if (filters.queueId) whereClause += ` AND OriginalQueueId = '${filters.queueId}'`;
  if (filters.agentId) whereClause += ` AND UserId = '${filters.agentId}'`;

  const soql = `
    SELECT Id, WorkItemId, RoutingModel, RoutingType, Status, CapacityWeight, CapacityPercentage,
           CreatedDate, AcceptDateTime, SpeedToAnswer, OriginalQueueId,
           ServiceChannel.MasterLabel,
           User.Name, User.Username
    FROM AgentWork
    WHERE ${whereClause}
    ORDER BY CreatedDate DESC
    LIMIT 200
  `;

  const records = await sfQuery<RawAgentWork>(org, soql);

  const queueIds = records.map((r) => r.OriginalQueueId).filter((id): id is string => !!id);
  const queueMap = await resolveQueueNames(org, queueIds);

  return records.map((r) => ({
    id: r.Id,
    workItemType: workItemTypeFromId(r.WorkItemId),
    workItemRef: r.WorkItemId.slice(-6).toUpperCase(),
    channelLabel: r.ServiceChannel?.MasterLabel ?? "Unknown",
    queueName: r.OriginalQueueId ? (queueMap.get(r.OriginalQueueId) ?? r.OriginalQueueId) : "Unknown",
    agentName: normalizeAgentName(r.User?.Name),
    routingModel: r.RoutingModel ?? inferRoutingModel(r.RoutingType),
    routingType: r.RoutingType ?? "Unknown",
    status: r.Status,
    createdDate: r.CreatedDate,
    acceptDateTime: r.AcceptDateTime,
    timeToAcceptSeconds: r.SpeedToAnswer ?? calcTimeToAccept(r.CreatedDate, r.AcceptDateTime),
  }));
}

export async function getRoutingTrace(
  org: OrgConnection,
  agentWorkId: string
): Promise<RoutingTrace> {
  const soql = `
    SELECT Id, WorkItemId, RoutingModel, RoutingType, RoutingPriority, Status,
           CapacityWeight, CapacityPercentage,
           CreatedDate, AcceptDateTime, SpeedToAnswer, OriginalQueueId,
           ServiceChannel.MasterLabel,
           User.Name, User.Username
    FROM AgentWork
    WHERE Id = '${agentWorkId}'
    LIMIT 1
  `;

  const records = await sfQuery<RawAgentWork>(org, soql);
  if (records.length === 0) throw new Error(`AgentWork record ${agentWorkId} not found`);
  const r = records[0];

  const queueMap = await resolveQueueNames(org, r.OriginalQueueId ? [r.OriginalQueueId] : []);
  const queueName = r.OriginalQueueId ? (queueMap.get(r.OriginalQueueId) ?? r.OriginalQueueId) : "Unknown";

  // AgentWorkSkill has no relationshipName so must be queried separately
  let agentSkills: Array<{ skillName: string; skillLevel: number | null }> = [];
  try {
    interface RawAgentWorkSkill { SkillLevel: number | null; Skill: { MasterLabel: string } | null }
    const skillRecords = await sfQuery<RawAgentWorkSkill>(
      org,
      `SELECT SkillLevel, Skill.MasterLabel FROM AgentWorkSkill WHERE AgentWorkId = '${agentWorkId}' LIMIT 50`
    );
    agentSkills = skillRecords
      .filter((s) => s.Skill != null)
      .map((s) => ({ skillName: s.Skill!.MasterLabel, skillLevel: s.SkillLevel }));
  } catch {
    // AgentWorkSkill may not be accessible in all orgs
  }

  // Required skills lookup skipped — RoutingConfigQueueMappedSkill nested subquery
  // times out on most orgs. Skills info comes from AgentWorkSkill records instead.
  const requiredSkills: Array<{ skillName: string; skillLevel: number | null }> = [];

  const timeToAccept = r.SpeedToAnswer ?? calcTimeToAccept(r.CreatedDate, r.AcceptDateTime);

  return {
    workItemId: r.Id,
    workItemType: workItemTypeFromId(r.WorkItemId),
    channelLabel: r.ServiceChannel?.MasterLabel ?? "Unknown",
    queueName,
    agentName: normalizeAgentName(r.User?.Name),
    agentUsername: r.User?.Username ?? "",
    routingModel: r.RoutingModel ?? inferRoutingModel(r.RoutingType),
    capacityWeight: r.CapacityWeight,
    capacityPercentage: r.CapacityPercentage,
    createdDate: r.CreatedDate,
    acceptDateTime: r.AcceptDateTime,
    timeToAcceptSeconds: timeToAccept,
    routingConfigName: null,
    routingConfigPriority: r.RoutingPriority ?? null,
    requiredSkills,
    agentSkills,
    status: r.Status,
  };
}

export async function listAgents(org: OrgConnection, search: string): Promise<Array<{ id: string; name: string }>> {
  const safe = search.replace(/'/g, "\\'");
  const soql = `SELECT Id, Name FROM User WHERE IsActive = true AND Name LIKE '%${safe}%' AND UserType = 'Standard' LIMIT 20`;
  interface RawUser { Id: string; Name: string }
  const records = await sfQuery<RawUser>(org, soql);
  return records.map((r) => ({ id: r.Id, name: r.Name }));
}

export async function listQueues(org: OrgConnection, search: string): Promise<Array<{ id: string; name: string }>> {
  const safe = search.replace(/'/g, "\\'");
  const soql = `SELECT Id, Name FROM Group WHERE Type = 'Queue' AND Name LIKE '%${safe}%' LIMIT 20`;
  const records = await sfQuery<RawGroup>(org, soql);
  return records.map((r) => ({ id: r.Id, name: r.Name }));
}

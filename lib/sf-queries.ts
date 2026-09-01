// ─── Salesforce data queries for RouteCause ───────────────────────────────────
// All functions here query AgentWork and related objects via the REST API.
// Customer enrichment data (Case, VoiceCall, MessagingSession) is fetched
// for display in the browser only — it is never passed to Claude or any external API.

import { sfQuery, workItemTypeFromId } from "./salesforce";
import {
  OrgConnection,
  WorkItemRow,
  RoutingTrace,
  RoutingChain,
  RoutingLeg,
  CustomerInfo,
} from "./types";

// ─── Raw shapes returned by Salesforce REST SOQL ─────────────────────────────

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
  SpeedToAnswer: number | null; // Seconds; Salesforce pre-calculates this in most orgs
  OriginalQueueId: string | null; // The queue the work item was in when assigned
  ServiceChannel: { MasterLabel: string } | null;
  User: { Name: string; Username: string } | null;
}

interface RawGroup {
  Id: string;
  Name: string;
}

// ─── Helper: normalize agent name ────────────────────────────────────────────

// "Automated Process" is the system user name Salesforce uses when
// a Flow or Bot accepts a work item. Give it a friendlier display name.
function normalizeAgentName(name: string | null | undefined): string {
  if (!name) return "Unassigned";
  if (name === "Automated Process") return "Automated Process (Flow/Bot)";
  return name;
}

// ─── Helper: infer routing model from RoutingType ────────────────────────────

// RoutingModel is the authoritative field but RoutingType is a useful fallback
// when RoutingModel is blank or null on older AgentWork records.
function inferRoutingModel(routingType: string | null): string {
  if (!routingType) return "Standard";
  if (routingType === "ExternalRouting") return "ExternalRouting";
  if (routingType === "SkillsBased") return "SkillsBased";
  return "Standard";
}

// ─── Helper: calculate time to accept ────────────────────────────────────────

// Salesforce populates SpeedToAnswer on AgentWork records in most orgs.
// If it's missing, we calculate it from CreatedDate and AcceptDateTime ourselves.
function calcTimeToAccept(
  created: string,
  accepted: string | null,
): number | null {
  if (!accepted) return null;
  return Math.round(
    (new Date(accepted).getTime() - new Date(created).getTime()) / 1000,
  );
}

// ─── Customer enrichment ──────────────────────────────────────────────────────

// Looks up customer info for all work item IDs in a batch.
// Groups them by object type (Case / VoiceCall / MessagingSession) using the
// Salesforce record ID prefix, then fires three parallel queries.
//
// PRIVACY: This data is displayed in the admin's browser only.
// It must never be sent to Claude or any external service.
async function resolveCustomerInfo(
  org: OrgConnection,
  records: { WorkItemId: string }[],
): Promise<Map<string, CustomerInfo>> {
  const map = new Map<string, CustomerInfo>();

  // Separate work item IDs by their 3-char prefix to determine object type
  const byType: Record<string, string[]> = { "500": [], "0Oc": [], "0Mh": [] };
  for (const r of records) {
    const prefix = r.WorkItemId.substring(0, 3);
    if (byType[prefix]) byType[prefix].push(r.WorkItemId);
  }

  await Promise.all([
    // Cases (prefix 500): fetch CaseNumber + Contact details
    (async () => {
      if (!byType["500"].length) return;
      const ids = byType["500"].map((id) => `'${id}'`).join(",");
      try {
        interface RawCase {
          Id: string;
          CaseNumber: string;
          Contact: { Id: string; Name: string; Phone: string | null } | null;
        }
        const rows = await sfQuery<RawCase>(
          org,
          `SELECT Id, CaseNumber, Contact.Id, Contact.Name, Contact.Phone FROM Case WHERE Id IN (${ids})`,
        );
        for (const c of rows) {
          map.set(c.Id, {
            workItemId: c.Id,
            caseNumber: c.CaseNumber,
            caseId: c.Id,
            contactName: c.Contact?.Name ?? null,
            contactId: c.Contact?.Id ?? null,
            phone: c.Contact?.Phone ?? null,
          });
        }
      } catch {
        /* Case may not be accessible in all org permission sets */
      }
    })(),

    // VoiceCalls (prefix 0Oc): fetch inbound phone number
    // Note: VoiceCall doesn't link to a Case — it IS the work item.
    (async () => {
      if (!byType["0Oc"].length) return;
      const ids = byType["0Oc"].map((id) => `'${id}'`).join(",");
      try {
        interface RawVoiceCall {
          Id: string;
          FromPhoneNumber: string | null;
        }
        const rows = await sfQuery<RawVoiceCall>(
          org,
          `SELECT Id, FromPhoneNumber FROM VoiceCall WHERE Id IN (${ids})`,
        );
        for (const v of rows) {
          map.set(v.Id, {
            workItemId: v.Id,
            caseNumber: null,
            caseId: null, // VoiceCall is not linked to a Case
            contactName: null,
            contactId: null,
            phone: v.FromPhoneNumber ?? null,
          });
        }
      } catch {
        /* VoiceCall may not be accessible */
      }
    })(),

    // MessagingSessions (prefix 0Mh): fetch end user name
    (async () => {
      if (!byType["0Mh"].length) return;
      const ids = byType["0Mh"].map((id) => `'${id}'`).join(",");
      try {
        interface RawSession {
          Id: string;
          MessagingEndUser: { Id: string; Name: string } | null;
        }
        const rows = await sfQuery<RawSession>(
          org,
          `SELECT Id, MessagingEndUser.Id, MessagingEndUser.Name FROM MessagingSession WHERE Id IN (${ids})`,
        );
        for (const s of rows) {
          map.set(s.Id, {
            workItemId: s.Id,
            caseNumber: null,
            caseId: null,
            contactName: s.MessagingEndUser?.Name ?? null,
            contactId: s.MessagingEndUser?.Id ?? null,
            phone: null,
          });
        }
      } catch {
        /* MessagingSession may not be accessible */
      }
    })(),
  ]);

  return map;
}

// ─── Helper: build a one-line customer summary label ─────────────────────────

// Used in the work items list as a compact summary of who the work is from.
function customerLabel(info: CustomerInfo | null | undefined): string | null {
  if (!info) return null;
  if (info.caseNumber && info.contactName)
    return `Case ${info.caseNumber} · ${info.contactName}`;
  if (info.caseNumber) return `Case ${info.caseNumber}`;
  if (info.phone) return `Call from ${info.phone}`;
  if (info.contactName) return info.contactName;
  return null;
}

// ─── Helper: resolve queue names from Group IDs ───────────────────────────────

// Salesforce stores Omni-Channel queues as Group records.
// We fetch names for all queue IDs on the page so the list shows real names
// instead of 18-char record IDs.
async function resolveQueueNames(
  org: OrgConnection,
  queueIds: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(queueIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const ids = unique.map((id) => `'${id}'`).join(",");
  const records = await sfQuery<RawGroup>(
    org,
    `SELECT Id, Name FROM Group WHERE Id IN (${ids})`,
  );
  return new Map(records.map((r) => [r.Id, r.Name]));
}

// ─── listWorkItems ────────────────────────────────────────────────────────────

// Fetches the most recent AgentWork records (up to 200) for the work items list page.
// Applies optional filters for channel, queue, and agent.
// Enriches each record with customer info and queue name in parallel.
export async function listWorkItems(
  org: OrgConnection,
  days: number = 7,
  filters: { channelId?: string; queueId?: string; agentId?: string } = {},
): Promise<WorkItemRow[]> {
  // Build the ISO timestamp for the start of the time window
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let whereClause = `CreatedDate >= ${since}`;
  if (filters.channelId)
    whereClause += ` AND ServiceChannelId = '${filters.channelId}'`;
  if (filters.queueId)
    whereClause += ` AND OriginalQueueId = '${filters.queueId}'`;
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

  // Kick off queue name resolution and customer enrichment in parallel
  const queueIds = records
    .map((r) => r.OriginalQueueId)
    .filter((id): id is string => !!id);
  const [queueMap, customerMap] = await Promise.all([
    resolveQueueNames(org, queueIds),
    resolveCustomerInfo(org, records),
  ]);

  // Map raw Salesforce records to the WorkItemRow shape used by the UI
  return records.map((r) => {
    const info = customerMap.get(r.WorkItemId) ?? null;
    return {
      id: r.Id,
      workItemType: workItemTypeFromId(r.WorkItemId),
      workItemRef: r.WorkItemId.slice(-6).toUpperCase(), // Short reference for the list view
      customerLabel: customerLabel(info),
      customer: info,
      channelLabel: r.ServiceChannel?.MasterLabel ?? "Unknown",
      queueName: r.OriginalQueueId
        ? (queueMap.get(r.OriginalQueueId) ?? r.OriginalQueueId)
        : "Unknown",
      agentName: normalizeAgentName(r.User?.Name),
      routingModel: r.RoutingModel ?? inferRoutingModel(r.RoutingType),
      routingType: r.RoutingType ?? "Unknown",
      status: r.Status,
      createdDate: r.CreatedDate,
      acceptDateTime: r.AcceptDateTime,
      timeToAcceptSeconds:
        r.SpeedToAnswer ?? calcTimeToAccept(r.CreatedDate, r.AcceptDateTime),
    };
  });
}

// ─── getRoutingTrace ──────────────────────────────────────────────────────────

// Fetches the full routing trace for a single AgentWork record.
// Used on the trace page (/trace/[id]) to show everything about one routing event.
// Also fetches AgentWorkSkill records separately (no subquery relationship in the API).
export async function getRoutingTrace(
  org: OrgConnection,
  agentWorkId: string,
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
  if (records.length === 0)
    throw new Error(`AgentWork record ${agentWorkId} not found`);
  const r = records[0];

  const queueMap = await resolveQueueNames(
    org,
    r.OriginalQueueId ? [r.OriginalQueueId] : [],
  );
  const queueName = r.OriginalQueueId
    ? (queueMap.get(r.OriginalQueueId) ?? r.OriginalQueueId)
    : "Unknown";

  // AgentWorkSkill has no relationship name on AgentWork, so we must query it separately.
  // These are the skill records created at the time of routing — what the agent actually had.
  let agentSkills: Array<{ skillName: string; skillLevel: number | null }> = [];
  try {
    interface RawAgentWorkSkill {
      SkillLevel: number | null;
      Skill: { MasterLabel: string } | null;
    }
    const skillRecords = await sfQuery<RawAgentWorkSkill>(
      org,
      `SELECT SkillLevel, Skill.MasterLabel FROM AgentWorkSkill WHERE AgentWorkId = '${agentWorkId}' LIMIT 50`,
    );
    agentSkills = skillRecords
      .filter((s) => s.Skill != null)
      .map((s) => ({
        skillName: s.Skill!.MasterLabel,
        skillLevel: s.SkillLevel,
      }));
  } catch {
    // AgentWorkSkill may not be accessible in all orgs — silently omit
  }

  // Required skills lookup is omitted — RoutingConfigQueueMappedSkill
  // nested subqueries time out on most orgs. Skills info comes from
  // the AgentWorkSkill records above instead.
  const requiredSkills: Array<{
    skillName: string;
    skillLevel: number | null;
  }> = [];

  const timeToAccept =
    r.SpeedToAnswer ?? calcTimeToAccept(r.CreatedDate, r.AcceptDateTime);
  const customerInfoMap = await resolveCustomerInfo(org, [r]);
  const customer = customerInfoMap.get(r.WorkItemId) ?? null;

  return {
    workItemId: r.Id, // AgentWork ID
    sfWorkItemId: r.WorkItemId, // The Case / VoiceCall / MessagingSession ID
    workItemType: workItemTypeFromId(r.WorkItemId),
    customer,
    instanceUrl: org.instanceUrl,
    channelLabel: r.ServiceChannel?.MasterLabel ?? "Unknown",
    queueName,
    agentName: normalizeAgentName(r.User?.Name),
    agentUsername: r.User?.Username ?? "",
    routingModel: r.RoutingModel ?? inferRoutingModel(r.RoutingType),
    routingType: r.RoutingType ?? null,
    capacityWeight: r.CapacityWeight,
    capacityPercentage: r.CapacityPercentage,
    createdDate: r.CreatedDate,
    acceptDateTime: r.AcceptDateTime,
    timeToAcceptSeconds: timeToAccept,
    routingConfigName: null, // Not queryable via REST in most orgs — requires Metadata API
    routingConfigPriority: r.RoutingPriority ?? null,
    requiredSkills,
    agentSkills,
    status: r.Status,
  };
}

// ─── Typeahead queries ────────────────────────────────────────────────────────

// Returns matching active standard users — used in the CorrectionPanel agent typeahead.
// Single-quote escaping prevents SOQL injection from the search input.
export async function listAgents(
  org: OrgConnection,
  search: string,
): Promise<Array<{ id: string; name: string }>> {
  const safe = search.replace(/'/g, "\\'");
  const soql = `SELECT Id, Name FROM User WHERE IsActive = true AND Name LIKE '%${safe}%' AND UserType = 'Standard' LIMIT 20`;
  interface RawUser {
    Id: string;
    Name: string;
  }
  const records = await sfQuery<RawUser>(org, soql);
  return records.map((r) => ({ id: r.Id, name: r.Name }));
}

// Returns matching queues — used in the CorrectionPanel queue typeahead.
export async function listQueues(
  org: OrgConnection,
  search: string,
): Promise<Array<{ id: string; name: string }>> {
  const safe = search.replace(/'/g, "\\'");
  const soql = `SELECT Id, Name FROM Group WHERE Type = 'Queue' AND Name LIKE '%${safe}%' LIMIT 20`;
  const records = await sfQuery<RawGroup>(org, soql);
  return records.map((r) => ({ id: r.Id, name: r.Name }));
}

// ─── getRoutingChain ──────────────────────────────────────────────────────────

// Fetches all routing legs for a work item, starting from any AgentWork ID in
// that conversation. Used on the trace page to show the complete routing story
// when a work item was routed more than once (e.g. bot → human escalation).
//
// Strategy:
//   1. Fetch the clicked AgentWork to get its WorkItemId.
//   2. Query ALL AgentWork records for that WorkItemId, ordered chronologically.
//   3. Batch-fetch AgentWorkSkill for all legs in one query.
//   4. Resolve queue names for all unique OriginalQueueIds in one query.
//   5. Fetch customer info once (WorkItemId is the same for every leg).
//   6. Build and return a RoutingChain.
export async function getRoutingChain(
  org: OrgConnection,
  agentWorkId: string,
): Promise<RoutingChain> {
  // ── Step 1: resolve the WorkItemId from the clicked AgentWork ────────────
  const anchorSoql = `
    SELECT Id, WorkItemId
    FROM AgentWork
    WHERE Id = '${agentWorkId}'
    LIMIT 1
  `;
  const anchorRecords = await sfQuery<{ Id: string; WorkItemId: string }>(
    org,
    anchorSoql,
  );
  if (anchorRecords.length === 0) {
    throw new Error(`AgentWork record ${agentWorkId} not found`);
  }
  const workItemId = anchorRecords[0].WorkItemId;

  // ── Step 2: fetch ALL AgentWork legs for this work item ──────────────────
  const chainSoql = `
    SELECT Id, WorkItemId, RoutingModel, RoutingType, RoutingPriority, Status,
           CapacityWeight, CapacityPercentage,
           CreatedDate, AcceptDateTime, SpeedToAnswer, OriginalQueueId,
           ServiceChannel.MasterLabel,
           User.Name, User.Username
    FROM AgentWork
    WHERE WorkItemId = '${workItemId}'
    ORDER BY CreatedDate ASC
  `;
  const allLegs = await sfQuery<RawAgentWork>(org, chainSoql);
  if (allLegs.length === 0) {
    throw new Error(`No AgentWork records found for WorkItemId ${workItemId}`);
  }

  // ── Step 3: batch-fetch AgentWorkSkill for all legs ──────────────────────
  const allIds = allLegs.map((r) => `'${r.Id}'`).join(",");
  const skillsByLeg = new Map<
    string,
    Array<{ skillName: string; skillLevel: number | null }>
  >();
  // Pre-populate so every leg has an entry even if the query returns nothing
  for (const r of allLegs) skillsByLeg.set(r.Id, []);
  try {
    interface RawAgentWorkSkill {
      AgentWorkId: string;
      SkillLevel: number | null;
      Skill: { MasterLabel: string } | null;
    }
    const skillRecords = await sfQuery<RawAgentWorkSkill>(
      org,
      `SELECT AgentWorkId, SkillLevel, Skill.MasterLabel
       FROM AgentWorkSkill
       WHERE AgentWorkId IN (${allIds})
       LIMIT 500`,
    );
    for (const s of skillRecords) {
      if (!s.Skill) continue;
      const bucket = skillsByLeg.get(s.AgentWorkId) ?? [];
      bucket.push({ skillName: s.Skill.MasterLabel, skillLevel: s.SkillLevel });
      skillsByLeg.set(s.AgentWorkId, bucket);
    }
  } catch {
    // AgentWorkSkill may not be accessible in all orgs — silently omit
  }

  // ── Step 4: resolve queue names for all unique OriginalQueueIds ──────────
  const uniqueQueueIds = Array.from(
    new Set(
      allLegs.map((r) => r.OriginalQueueId).filter((id): id is string => !!id),
    ),
  );
  const queueMap = await resolveQueueNames(org, uniqueQueueIds);

  // ── Step 5: fetch customer info once (same WorkItemId across all legs) ───
  const customerInfoMap = await resolveCustomerInfo(org, [
    { WorkItemId: workItemId },
  ]);
  const customer = customerInfoMap.get(workItemId) ?? null;
  const workItemType = workItemTypeFromId(workItemId);

  // ── Step 6: build RoutingLeg objects ─────────────────────────────────────
  const legs: RoutingLeg[] = allLegs.map((r, index) => {
    const isAI = r.User?.Name === "Automated Process" || r.User?.Name == null;
    const queueName = r.OriginalQueueId
      ? (queueMap.get(r.OriginalQueueId) ?? r.OriginalQueueId)
      : "Unknown";

    return {
      agentWorkId: r.Id,
      legIndex: index,
      isAI,
      agentName: normalizeAgentName(r.User?.Name),
      agentUsername: r.User?.Username ?? "",
      channelLabel: r.ServiceChannel?.MasterLabel ?? "Unknown",
      queueName,
      routingModel: r.RoutingModel ?? inferRoutingModel(r.RoutingType),
      routingType: r.RoutingType ?? null,
      capacityWeight: r.CapacityWeight,
      capacityPercentage: r.CapacityPercentage,
      createdDate: r.CreatedDate,
      acceptDateTime: r.AcceptDateTime,
      timeToAcceptSeconds:
        r.SpeedToAnswer ?? calcTimeToAccept(r.CreatedDate, r.AcceptDateTime),
      routingConfigPriority: r.RoutingPriority ?? null,
      status: r.Status,
      agentSkills: skillsByLeg.get(r.Id) ?? [],
      requiredSkills: [], // RoutingConfigQueueMappedSkill nested subqueries time out on most orgs
      flags: [],
    };
  });

  // ── Build chain-level flags ───────────────────────────────────────────────
  const chainFlags: RoutingChain["chainFlags"] = [];

  if (legs.length > 1) {
    chainFlags.push({
      type: "info",
      message: `This conversation had ${legs.length} routing legs — the full chain is shown below.`,
    });
  }

  if (workItemType === "Voice Call" && legs.length === 1 && legs[0].isAI) {
    chainFlags.push({
      type: "info",
      message:
        "Only the AI agent leg was found. If a human handled this call, it may be on a separate VoiceCall record (BYOT architecture) or the call ended before escalation.",
    });
  }

  return {
    entryAgentWorkId: agentWorkId,
    sfWorkItemId: workItemId,
    workItemType,
    customer,
    instanceUrl: org.instanceUrl,
    legs,
    chainFlags,
  };
}

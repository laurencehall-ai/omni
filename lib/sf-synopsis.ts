// ─── Org synopsis queries ─────────────────────────────────────────────────────
// Fetches the top-level Omni-Channel configuration objects needed for the
// Synopsis page. Many of these objects (RoutingConfig, QueueRoutingConfig,
// ServicePresenceConfig) are only accessible via the Tooling API —
// the standard REST SOQL endpoint returns a INVALID_TYPE error for them.
//
// Even the Tooling API may fail in some orgs with strict permission sets.
// Each query is wrapped in tryQuery() so the page degrades gracefully
// by marking the object as unavailable rather than crashing.

import { sfQuery, sfToolingQuery } from "./salesforce";
import { OrgConnection } from "./types";

// The full shape of data returned to the synopsis page.
// null arrays mean the object was inaccessible — the UI shows a notice.
export interface SynopsisData {
  channels: Array<{ id: string; label: string }>;
  queues: Array<{ id: string; name: string }> | null;
  routingConfigs: Array<{
    id: string;
    name: string;
    routingModel: string;
    capacityWeight: number | null;
    priority: number | null;
  }> | null;
  presenceConfigs: Array<{ id: string; name: string }> | null;
  skills: Array<{ id: string; name: string }>;
  agentCount: number;
  queueConfigLinks: Array<{ queueId: string; routingConfigId: string }>;
  unavailableObjects: string[]; // List of object names that couldn't be queried
}

// Raw Salesforce record shapes for each query
interface ServiceChannelRecord {
  Id: string;
  MasterLabel: string;
}
interface RoutingConfigRecord {
  Id: string;
  MasterLabel: string;
  RoutingModel: string;
  CapacityWeight: number | null;
  Priority: number | null;
}
interface QueueRoutingConfigRecord {
  Id: string;
  QueueId: string;
  RoutingConfigId: string;
}
interface PresenceConfigRecord {
  Id: string;
  MasterLabel: string;
}
interface SkillRecord {
  Id: string;
  MasterLabel: string;
}
interface UserRecord {
  Id: string;
}
interface GroupRecord {
  Id: string;
  Name: string;
}
interface QueueRecord {
  Id: string;
  Name: string;
}

// Union type so we can try a query and handle failure without throwing
type QueryResult<T> =
  { ok: true; records: T[] } | { ok: false; object: string };

// Runs a SOQL query and returns a success/failure union.
// Failures are caught so the caller can continue with partial data.
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

// ─── getOrgSynopsis ───────────────────────────────────────────────────────────

// Fetches all Omni-Channel configuration objects in parallel.
// Returns a SynopsisData where null fields indicate objects that couldn't be queried.
export async function getOrgSynopsis(
  org: OrgConnection,
): Promise<SynopsisData> {
  // All six queries fire in parallel to minimize total latency.
  // ServiceChannel and Skill/User are standard REST; the others require Tooling API.
  const [
    channelRes,
    routingConfigRes,
    queueRoutingConfigRes,
    presenceConfigRes,
    skillRes,
    userRes,
    queueRes,
  ] = await Promise.all([
    tryQuery<ServiceChannelRecord>(
      org,
      "ServiceChannel",
      "SELECT Id, MasterLabel FROM ServiceChannel LIMIT 100",
    ),
    tryQuery<RoutingConfigRecord>(
      org,
      "RoutingConfig",
      "SELECT Id, MasterLabel, RoutingModel, CapacityWeight, Priority FROM RoutingConfig LIMIT 100",
      true,
    ), // Tooling API
    tryQuery<QueueRoutingConfigRecord>(
      org,
      "QueueRoutingConfig",
      "SELECT Id, QueueId, RoutingConfigId FROM QueueRoutingConfig LIMIT 200",
      true,
    ), // Tooling API
    tryQuery<PresenceConfigRecord>(
      org,
      "ServicePresenceConfig",
      "SELECT Id, MasterLabel FROM ServicePresenceConfig LIMIT 100",
      true,
    ), // Tooling API
    tryQuery<SkillRecord>(
      org,
      "Skill",
      "SELECT Id, MasterLabel FROM Skill LIMIT 100",
    ),
    tryQuery<UserRecord>(
      org,
      "User (active)",
      "SELECT Id FROM User WHERE IsActive = true AND UserType = 'Standard' LIMIT 500",
    ),
    tryQuery<QueueRecord>(
      org,
      "Queue",
      "SELECT Id, Name FROM Group WHERE Type = 'Queue' LIMIT 200",
    ),
  ]);

  // Collect names of objects that failed so the UI can show a warning
  const unavailableObjects: string[] = [];
  if (!channelRes.ok) unavailableObjects.push(channelRes.object);
  if (!routingConfigRes.ok) unavailableObjects.push(routingConfigRes.object);
  if (!queueRoutingConfigRes.ok)
    unavailableObjects.push(queueRoutingConfigRes.object);
  if (!presenceConfigRes.ok) unavailableObjects.push(presenceConfigRes.object);
  if (!skillRes.ok) unavailableObjects.push(skillRes.object);
  if (!userRes.ok) unavailableObjects.push(userRes.object);

  const channels = channelRes.ok ? channelRes.records : [];
  const routingConfigs = routingConfigRes.ok ? routingConfigRes.records : null;
  const queueRoutingConfigs = queueRoutingConfigRes.ok
    ? queueRoutingConfigRes.records
    : null;
  const allQueues = queueRes.ok ? queueRes.records : null;
  const presenceConfigs = presenceConfigRes.ok
    ? presenceConfigRes.records
    : null;
  const skills = skillRes.ok ? skillRes.records : [];
  const users = userRes.ok ? userRes.records : [];

  // Build queue list — prefer direct Group query (same source as topology),
  // fall back to IDs extracted from QueueRoutingConfig if Group query failed
  const links: Array<{ queueId: string; routingConfigId: string }> = [];

  if (queueRoutingConfigs) {
    for (const qrc of queueRoutingConfigs) {
      if (qrc.QueueId && qrc.RoutingConfigId) {
        links.push({ queueId: qrc.QueueId, routingConfigId: qrc.RoutingConfigId });
      }
    }
  }

  let queues: Array<{ id: string; name: string }> | null = null;
  if (allQueues !== null) {
    // Direct Group query succeeded — use it (same data source as topology)
    queues = allQueues.map((q) => ({ id: q.Id, name: q.Name }));
  } else if (queueRoutingConfigs !== null) {
    // Fall back: resolve names for the IDs we got from QueueRoutingConfig
    const omniQueueIds = Array.from(
      new Set(queueRoutingConfigs.map((q) => q.QueueId).filter(Boolean)),
    );
    let queueMap = new Map<string, string>();
    if (omniQueueIds.length > 0) {
      try {
        const ids = omniQueueIds.map((id) => `'${id}'`).join(",");
        const groups = await sfQuery<GroupRecord>(
          org,
          `SELECT Id, Name FROM Group WHERE Id IN (${ids})`,
        );
        queueMap = new Map(groups.map((g) => [g.Id, g.Name]));
      } catch { /* names fall back to IDs */ }
    }
    const seen = new Set<string>();
    queues = [];
    for (const qrc of queueRoutingConfigs) {
      if (!seen.has(qrc.QueueId)) {
        seen.add(qrc.QueueId);
        queues.push({ id: qrc.QueueId, name: queueMap.get(qrc.QueueId) ?? qrc.QueueId });
      }
    }
  }

  return {
    channels: channels.map((c) => ({ id: c.Id, label: c.MasterLabel })),
    queues,
    routingConfigs:
      routingConfigs === null
        ? null
        : routingConfigs.map((r) => ({
            id: r.Id,
            name: r.MasterLabel,
            routingModel: r.RoutingModel,
            capacityWeight: r.CapacityWeight,
            priority: r.Priority,
          })),
    presenceConfigs:
      presenceConfigs === null
        ? null
        : presenceConfigs.map((p) => ({ id: p.Id, name: p.MasterLabel })),
    skills: skills.map((s) => ({ id: s.Id, name: s.MasterLabel })),
    agentCount: users.length,
    queueConfigLinks: links,
    unavailableObjects,
  };
}

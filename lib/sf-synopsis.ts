import { sfQuery } from "./salesforce";
import { OrgConnection } from "./types";

export interface SynopsisData {
  channels: Array<{ id: string; label: string; routingModel: string | null }>;
  queues: Array<{ id: string; name: string; routingConfigName: string | null; routingModel: string | null }>;
  routingConfigs: Array<{ id: string; name: string; routingModel: string; capacityWeight: number | null; priority: number | null }>;
  presenceConfigs: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
  agentCount: number;
}

interface ServiceChannelRecord {
  Id: string;
  MasterLabel: string;
  RoutingModel: string | null;
}

interface GroupRecord {
  Id: string;
  Name: string;
}

interface RoutingConfigRecord {
  Id: string;
  Name: string;
  RoutingModel: string;
  CapacityWeight: number | null;
  Priority: number | null;
}

interface PresenceConfigRecord {
  Id: string;
  Name: string;
}

interface SkillRecord {
  Id: string;
  MasterLabel: string;
}

interface UserRecord {
  Id: string;
}

export async function getOrgSynopsis(org: OrgConnection): Promise<SynopsisData> {
  const [channels, queues, routingConfigs, presenceConfigs, skills, users] = await Promise.all([
    sfQuery<ServiceChannelRecord>(
      org,
      "SELECT Id, MasterLabel, RoutingModel FROM ServiceChannel LIMIT 100"
    ).catch(() => [] as ServiceChannelRecord[]),

    sfQuery<GroupRecord>(
      org,
      "SELECT Id, Name FROM Group WHERE Type = 'Queue' LIMIT 200"
    ).catch(() => [] as GroupRecord[]),

    sfQuery<RoutingConfigRecord>(
      org,
      "SELECT Id, Name, RoutingModel, CapacityWeight, Priority FROM RoutingConfig LIMIT 100"
    ).catch(() => [] as RoutingConfigRecord[]),

    sfQuery<PresenceConfigRecord>(
      org,
      "SELECT Id, Name FROM ServicePresenceConfig LIMIT 100"
    ).catch(() => [] as PresenceConfigRecord[]),

    sfQuery<SkillRecord>(
      org,
      "SELECT Id, MasterLabel FROM Skill LIMIT 100"
    ).catch(() => [] as SkillRecord[]),

    sfQuery<UserRecord>(
      org,
      "SELECT Id FROM User WHERE IsActive = true AND UserType = 'Standard' LIMIT 500"
    ).catch(() => [] as UserRecord[]),
  ]);

  return {
    channels: channels.map((c) => ({
      id: c.Id,
      label: c.MasterLabel,
      routingModel: c.RoutingModel,
    })),
    queues: queues.map((q) => ({
      id: q.Id,
      name: q.Name,
      routingConfigName: null,
      routingModel: null,
    })),
    routingConfigs: routingConfigs.map((r) => ({
      id: r.Id,
      name: r.Name,
      routingModel: r.RoutingModel,
      capacityWeight: r.CapacityWeight,
      priority: r.Priority,
    })),
    presenceConfigs: presenceConfigs.map((p) => ({
      id: p.Id,
      name: p.Name,
    })),
    skills: skills.map((s) => ({
      id: s.Id,
      name: s.MasterLabel,
    })),
    agentCount: users.length,
  };
}

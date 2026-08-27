export interface OrgConnection {
  instanceUrl: string;
  accessToken: string;
  refreshToken: string;
  label: string;
}

export interface WorkItemRow {
  id: string;
  workItemType: string;
  workItemRef: string;
  channelLabel: string;
  queueName: string;
  agentName: string;
  routingModel: string;
  routingType: string;
  status: string;
  createdDate: string;
  acceptDateTime: string | null;
  timeToAcceptSeconds: number | null;
}

export interface RoutingTrace {
  workItemId: string;
  workItemType: string;
  channelLabel: string;
  queueName: string;
  agentName: string;
  agentUsername: string;
  routingModel: string;
  capacityWeight: number | null;
  capacityPercentage: number | null;
  createdDate: string;
  acceptDateTime: string | null;
  timeToAcceptSeconds: number | null;
  routingConfigName: string | null;
  routingConfigPriority: number | null;
  requiredSkills: SkillRequirement[];
  agentSkills: AgentSkill[];
  status: string;
}

export interface SkillRequirement {
  skillName: string;
  skillLevel: number | null;
}

export interface AgentSkill {
  skillName: string;
  skillLevel: number | null;
}

export interface RoutingExplanation {
  summary: string;
  routingModelExplanation: string;
  agentSelectionExplanation: string;
  skillsExplanation: string | null;
  capacityExplanation: string;
  flags: RoutingFlag[];
}

export interface RoutingFlag {
  type: "warning" | "info";
  message: string;
}

export interface CorrectionInput {
  targetAgentId?: string;
  targetAgentName?: string;
  targetQueueId?: string;
  targetQueueName?: string;
  reason?: string;
}

export interface ConfigSuggestion {
  likelyCause: string;
  suggestedChanges: SuggestedChange[];
  flowNote: string | null;
  confidence: "High" | "Medium" | "Low";
}

export interface SuggestedChange {
  area: string;
  currentValue: string;
  suggestedValue: string;
  rationale: string;
}

export interface AgentOption {
  id: string;
  name: string;
}

export interface QueueOption {
  id: string;
  name: string;
}

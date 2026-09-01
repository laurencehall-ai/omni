// ─── Core type definitions for RouteCause ───────────────────────────────────
// These interfaces are shared across API routes, lib modules, and React components.

// Credentials and instance URL for a connected Salesforce org.
// Stored in the encrypted iron-session cookie for the duration of the session.
export interface OrgConnection {
  instanceUrl: string;
  accessToken: string;
  refreshToken: string;
  label: string; // Human-readable org name shown in the UI
}

// Customer-identifying information resolved from the WorkItemId.
// Displayed in the browser only — never sent to Claude or any external API.
// The workItemId is the Salesforce record ID of the underlying object (Case, VoiceCall, etc.)
export interface CustomerInfo {
  workItemId: string; // Used as fallback link to view the record in Salesforce
  caseNumber: string | null;
  caseId: string | null;
  contactName: string | null;
  contactId: string | null;
  phone: string | null;
}

// A single row in the work items list page.
// Built from AgentWork + customer enrichment + queue name resolution.
export interface WorkItemRow {
  id: string; // AgentWork record ID
  workItemType: string; // Inferred from WorkItemId prefix (Case, Voice Call, etc.)
  workItemRef: string; // Last 6 chars of WorkItemId, shown as a short reference
  customerLabel: string | null; // Human-readable summary label for display
  customer: CustomerInfo | null; // Full customer info for the data table
  channelLabel: string; // Service channel name (e.g. "Cases", "Phone")
  queueName: string; // Queue the work item waited in
  agentName: string; // Agent it was assigned to
  routingModel: string; // LeastActive, MostAvailable, ExternalRouting, etc.
  routingType: string; // QueueBased, SkillsBased, OmniFlow, ExternalRouting
  status: string; // Opened, Assigned, Declined, etc.
  createdDate: string; // ISO timestamp
  acceptDateTime: string | null;
  timeToAcceptSeconds: number | null;
}

// Full routing trace for a single AgentWork record.
// This is the core data object used on the trace page.
export interface RoutingTrace {
  workItemId: string; // AgentWork record ID — used for API calls (suggest, etc.)
  sfWorkItemId: string; // The underlying SF record (Case, VoiceCall, MessagingSession, etc.)
  workItemType: string;
  customer: CustomerInfo | null;
  instanceUrl: string; // Used to build clickable Salesforce record links
  channelLabel: string;
  queueName: string;
  agentName: string;
  agentUsername: string;
  routingModel: string;
  routingType: string | null; // QueueBased, SkillsBased, OmniFlow, ExternalRouting
  capacityWeight: number | null;
  capacityPercentage: number | null;
  createdDate: string;
  acceptDateTime: string | null;
  timeToAcceptSeconds: number | null;
  routingConfigName: string | null; // null — RoutingConfig not queryable via REST in most orgs
  routingConfigPriority: number | null;
  requiredSkills: SkillRequirement[]; // Skills the routing config required
  agentSkills: AgentSkill[]; // Skills the assigned agent had at time of routing
  status: string;
}

// A skill that was required by the routing configuration.
export interface SkillRequirement {
  skillName: string;
  skillLevel: number | null;
}

// A skill recorded on the assigned agent at time of routing (from AgentWorkSkill).
export interface AgentSkill {
  skillName: string;
  skillLevel: number | null;
}

// The deterministic analysis output produced by routing-analyzer.ts.
// Used for the exec summary, full explanation, and as the basis for Claude's narration.
export interface RoutingExplanation {
  summary: string;
  routingModelExplanation: string;
  agentSelectionExplanation: string;
  skillsExplanation: string | null;
  capacityExplanation: string;
  flags: RoutingFlag[]; // Warnings and info messages surfaced in the UI
}

// A flag attached to a routing explanation — warnings shown as amber banners.
export interface RoutingFlag {
  type: "warning" | "info";
  message: string;
}

// Input from the admin describing how the work item should have routed.
// Collected by CorrectionPanel and sent to /api/suggest.
export interface CorrectionInput {
  targetAgentId?: string;
  targetAgentName?: string;
  targetQueueId?: string;
  targetQueueName?: string;
  reason?: string; // Optional free-text rationale from the admin
}

// Output from suggestConfiguration — displayed by SuggestionPanel.
export interface ConfigSuggestion {
  likelyCause: string;
  suggestedChanges: SuggestedChange[];
  flowNote: string | null; // Present if an Omni-Channel Flow may be involved
  confidence: "High" | "Medium" | "Low";
}

// A single recommended configuration change within a ConfigSuggestion.
export interface SuggestedChange {
  area: string; // Salesforce setting area (e.g. "Queue Membership", "Skill Requirements")
  currentValue: string; // What it is now
  suggestedValue: string; // What it should be
  rationale: string; // Why this change would fix the misrouting
}

// Used by the agent typeahead in CorrectionPanel.
export interface AgentOption {
  id: string;
  name: string;
}

// Used by the queue typeahead in CorrectionPanel.
export interface QueueOption {
  id: string;
  name: string;
}

// ─── Chain / multi-leg routing types ─────────────────────────────────────────
// A RoutingChain represents a work item that traversed more than one routing
// hop — e.g. first handled by an AI agent then escalated to a human agent.
// Each hop is a RoutingLeg; the chain collects flags across all legs.

// One leg of a routing chain — one AgentWork record.
// A conversation may be routed multiple times (e.g. AI triage leg followed by a human agent leg).
// Each leg corresponds to a distinct AgentWork record for the same underlying work item.
export interface RoutingLeg {
  // AgentWork.Id for this leg — unique identifier for the record in Salesforce.
  agentWorkId: string;
  // 0-based position in the chain (0 = first/earliest leg, typically the AI triage leg).
  legIndex: number;
  // true when the User.Name on the AgentWork is "Automated Process" (i.e. an AI/bot leg).
  isAI: boolean;
  // Display name of the agent or automated process assigned to this leg.
  agentName: string;
  // Salesforce username of the agent (used for linking and deduplication).
  agentUsername: string;
  // Name of the queue this leg was routed through.
  queueName: string;
  // Human-readable service channel label (e.g. "Phone", "Cases", "Chat").
  channelLabel: string;
  // Routing model used for this leg (LeastActive, MostAvailable, ExternalRouting, etc.).
  routingModel: string;
  // Routing type for this leg — QueueBased, SkillsBased, OmniFlow, ExternalRouting, or null if unknown.
  routingType: string | null;
  // AgentWork.Status for this leg (Opened, Assigned, Declined, etc.).
  status: string;
  // Capacity weight consumed by this leg, if capacity-based routing is in use.
  capacityWeight: number | null;
  // Capacity percentage consumed by this leg, if percentage-based capacity is configured.
  capacityPercentage: number | null;
  // ISO timestamp when this AgentWork record was created (work item entered the queue for this leg).
  createdDate: string;
  // ISO timestamp when the agent accepted this leg, or null if not yet accepted / declined.
  acceptDateTime: string | null;
  // Seconds from createdDate to acceptDateTime, or null if the leg was never accepted.
  timeToAcceptSeconds: number | null;
  // Priority value from the routing configuration, or null if unavailable.
  routingConfigPriority: number | null;
  // Skills the assigned agent had at the time of routing for this leg (from AgentWorkSkill).
  agentSkills: AgentSkill[];
  // Skills required by the routing configuration for this leg.
  requiredSkills: SkillRequirement[];
  // Per-leg flags emitted by the analyzer (e.g. skill mismatch warnings, capacity notes).
  flags: RoutingFlag[];
}

// The full routing chain for one conversation — all AgentWork legs ordered oldest to newest.
// This is the top-level structure produced by the chain-builder and consumed by the trace page.
export interface RoutingChain {
  // The AgentWork ID the admin originally clicked — used as the entry point for the suggest API.
  entryAgentWorkId: string;
  // The underlying Salesforce record ID (VoiceCall, Case, MessagingSession, etc.).
  sfWorkItemId: string;
  // Human-readable type inferred from the sfWorkItemId prefix (e.g. "Voice Call", "Case").
  workItemType: string;
  // Org instance URL — used to build clickable Salesforce record deep-links in the UI.
  instanceUrl: string;
  // Customer info resolved from the work item, or null if resolution failed or is not applicable.
  customer: CustomerInfo | null;
  // All routing legs for this conversation, ordered oldest first (index 0 = first leg).
  legs: RoutingLeg[];
  // Chain-level flags that span multiple legs (e.g. escalation detected, BYOT caveat present).
  chainFlags: RoutingFlag[];
}

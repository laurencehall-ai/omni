/**
 * ─── Data Guard ───────────────────────────────────────────────────────────────
 * HARD RULE: Customer data must never leave the org or be sent to any third party.
 *
 * This module is the single enforcement point before any routing data reaches Claude.
 * It accepts a full RoutingTrace (which may include customer info) and returns
 * a stripped payload containing only routing infrastructure metadata and agent info.
 *
 * Customer records (Case, Contact, VoiceCall, MessagingSession) are displayed
 * in the admin's browser only — the same as a standard Salesforce list view.
 * They are never included in any payload sent to the Claude API.
 */

import { RoutingTrace } from "./types";

// The complete whitelist of RoutingTrace fields that are safe to send to Claude.
// Any field not listed here is implicitly excluded.
const SAFE_FIELDS: (keyof RoutingTrace)[] = [
  "workItemType",          // e.g. "Case" — the type of work, not the case content
  // sfWorkItemId intentionally excluded — it's a SF record ID that could identify a customer
  "channelLabel",          // e.g. "Phone" — the service channel name
  "queueName",             // e.g. "Tier 1 Support" — the queue name
  "agentName",             // Admins are the users — agent names are safe
  "agentUsername",
  "routingModel",          // LeastActive, MostAvailable, etc.
  "routingType",           // QueueBased, SkillsBased, OmniFlow, ExternalRouting
  "capacityWeight",
  "capacityPercentage",
  "createdDate",
  "acceptDateTime",
  "timeToAcceptSeconds",
  "routingConfigName",
  "routingConfigPriority",
  "requiredSkills",        // Skill names (not customer attributes)
  "agentSkills",
  "status",
];

// workItemId is explicitly excluded — it is a Salesforce record ID that could
// be used to look up customer data. We never send it to any external system.

// Builds a safe payload for Claude by including only whitelisted fields.
// Called in claude.ts before every Claude API call.
export function buildSafePayload(trace: RoutingTrace): Partial<RoutingTrace> {
  return SAFE_FIELDS.reduce((acc, key) => {
    acc[key] = trace[key] as never;
    return acc;
  }, {} as Partial<RoutingTrace>);
}

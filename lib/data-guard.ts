/**
 * Hard rule: customer data must never leave the org or be sent to any third party.
 * This module is the single enforcement point before any data reaches Claude.
 *
 * All data passed to buildSafePayload() is scrubbed to contain only routing
 * infrastructure metadata and agent info. Customer records are never fetched
 * upstream, but this is a defense-in-depth check.
 */

import { RoutingTrace } from "./types";

// Fields on RoutingTrace that are safe to include in the Claude payload.
const SAFE_FIELDS: (keyof RoutingTrace)[] = [
  "workItemType",
  "channelLabel",
  "queueName",
  "agentName",
  "agentUsername",
  "routingModel",
  "capacityWeight",
  "capacityPercentage",
  "createdDate",
  "acceptDateTime",
  "timeToAcceptSeconds",
  "routingConfigName",
  "routingConfigPriority",
  "requiredSkills",
  "agentSkills",
  "status",
];

// workItemId is explicitly excluded — it is a Salesforce record ID that could
// be used to look up customer data. We never send it externally.

export function buildSafePayload(trace: RoutingTrace): Partial<RoutingTrace> {
  return SAFE_FIELDS.reduce((acc, key) => {
    acc[key] = trace[key] as never;
    return acc;
  }, {} as Partial<RoutingTrace>);
}

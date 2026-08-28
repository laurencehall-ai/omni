// ─── Deterministic routing analyzer ──────────────────────────────────────────
// Produces a structured RoutingExplanation from a RoutingTrace without calling Claude.
// This runs first — Claude narrates on top of it (if an API key is available).
// The explanation is based entirely on the routing metadata: model, queue, agent,
// skills, capacity, and timing. No customer data is touched here.

import { RoutingTrace, RoutingFlag, RoutingChain, RoutingLeg } from "./types";

// Formats a duration in seconds to a human-readable string for flag messages.
function secondsToHuman(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m} minutes`;
}

// Maps Salesforce RoutingModel API values to human-readable labels.
const ROUTING_MODEL_LABELS: Record<string, string> = {
  LeastActive: "Least Active",
  MostAvailable: "Most Available",
};

// Maps Salesforce RoutingType API values to human-readable labels.
// RoutingType describes HOW the routing decision is made (the mechanism).
// RoutingModel describes the agent-selection algorithm within that mechanism.
const ROUTING_TYPE_LABELS: Record<string, string> = {
  QueueBased:      "Queue-Based",
  SkillsBased:     "Skills-Based",
  OmniFlow:        "Omni-Channel Flow",
  ExternalRouting: "External Routing",
};

function routingModelLabel(model: string): string {
  return ROUTING_MODEL_LABELS[model] ?? model;
}

function routingTypeLabel(type: string | null): string {
  if (!type) return "Unknown";
  return ROUTING_TYPE_LABELS[type] ?? type;
}

function isExternal(trace: RoutingTrace): boolean {
  return trace.routingType === "ExternalRouting" || trace.routingModel === "ExternalRouting";
}


// ─── analyzeLeg ──────────────────────────────────────────────────────────────

// Produces per-leg routing flags from the flat RoutingLeg shape.
// Checks external routing, timing, capacity, and skill mismatches.
export function analyzeLeg(leg: RoutingLeg, _chain: RoutingChain): RoutingFlag[] {
  const flags: RoutingFlag[] = [];
  const n = leg.legIndex + 1;
  const legLabel = leg.isAI ? `Leg ${n} (AI)` : `Leg ${n}`;

  if (leg.routingType === "ExternalRouting" || leg.routingModel === "ExternalRouting") {
    flags.push({
      type: "warning",
      message: `${legLabel}: This leg used External Routing. Salesforce did not control the routing decision — an external system determined the assignment.`,
    });
  }

  if (leg.timeToAcceptSeconds != null) {
    if (leg.timeToAcceptSeconds > 300) {
      flags.push({
        type: "warning",
        message: `${legLabel}: Long time to accept — ${secondsToHuman(leg.timeToAcceptSeconds)}. This may indicate the queue was understaffed or capacity weights are too high.`,
      });
    }
  } else {
    flags.push({
      type: "info",
      message: `${legLabel}: This leg has not been accepted yet, or accept time was not recorded.`,
    });
  }

  if (leg.capacityPercentage != null && leg.capacityPercentage >= 90) {
    flags.push({
      type: "warning",
      message: `${legLabel}: Agent was near full capacity (${leg.capacityPercentage}%) when assigned. Consider reviewing capacity weights or agent workload.`,
    });
  }

  if (leg.requiredSkills.length > 0) {
    const requiredNames = new Set(leg.requiredSkills.map((s) => s.skillName));
    const agentNames = new Set(leg.agentSkills.map((s) => s.skillName));
    const missing = Array.from(requiredNames).filter((n) => !agentNames.has(n));
    if (missing.length > 0) {
      flags.push({
        type: "warning",
        message: `${legLabel}: Agent skill mismatch — required skills [${missing.join(", ")}] were not recorded on the assigned agent.`,
      });
    }
  }

  return flags;
}

// ─── analyzeChain ─────────────────────────────────────────────────────────────

// Runs analyzeLeg() on every leg (mutating leg.flags), then adds chain-level flags.
// Returns the mutated chain.
export function analyzeChain(chain: RoutingChain): RoutingChain {
  for (const leg of chain.legs) {
    leg.flags = analyzeLeg(leg, chain);
  }

  // Flag the first AI→human escalation detected in the chain.
  if (chain.legs.length > 1) {
    for (let i = 0; i < chain.legs.length - 1; i++) {
      if (chain.legs[i].isAI && !chain.legs[i + 1].isAI) {
        chain.chainFlags.push({
          type: "info",
          message: `AI-to-human escalation detected: Leg ${i + 1} (AI) handed off to Leg ${i + 2} (${chain.legs[i + 1].agentName}). Review bot containment rate and escalation triggers if this pattern is frequent.`,
        });
        break;
      }
    }
  }

  return chain;
}

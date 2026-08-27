import { RoutingTrace, RoutingExplanation, RoutingFlag } from "./types";

function secondsToHuman(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m} minutes`;
}

const ROUTING_MODEL_LABELS: Record<string, string> = {
  LeastActive: "Least Active",
  MostAvailable: "Most Available",
  ExternalRouting: "External Routing",
};

function routingModelLabel(model: string): string {
  return ROUTING_MODEL_LABELS[model] ?? model;
}

export function analyzeRouting(trace: RoutingTrace): RoutingExplanation {
  const flags: RoutingFlag[] = [];

  // --- Routing model explanation ---
  const modelLabel = routingModelLabel(trace.routingModel);
  let routingModelExplanation = "";

  switch (trace.routingModel) {
    case "LeastActive":
      routingModelExplanation = `The queue uses the **Least Active** model, which assigns work to the agent with the fewest currently open items. ${trace.agentName} was selected because they had fewer active items than any other available agent in the queue at the time of routing.`;
      break;
    case "MostAvailable":
      routingModelExplanation = `The queue uses the **Most Available** model, which assigns work to the agent with the most remaining capacity. ${trace.agentName} had the highest available capacity percentage (${trace.capacityPercentage ?? "unknown"}%) in the queue at the time of routing.`;
      break;
    case "ExternalRouting":
      routingModelExplanation = `This work item was routed by an **External Routing** integration. Salesforce delegated the routing decision to an external system, which assigned it to ${trace.agentName}.`;
      break;
    default:
      routingModelExplanation = `The routing model in use was **${modelLabel}**. ${trace.agentName} was selected by Omni-Channel based on this model's rules.`;
  }

  // --- Agent selection explanation ---
  const agentSelectionExplanation = `The work item was assigned to **${trace.agentName}** (${trace.agentUsername}) in the **${trace.queueName}** queue via the **${trace.channelLabel}** channel.`;

  // --- Skills explanation ---
  let skillsExplanation: string | null = null;
  if (trace.requiredSkills.length > 0) {
    const requiredList = trace.requiredSkills
      .map((s) => `${s.skillName}${s.skillLevel ? ` (level ${s.skillLevel})` : ""}`)
      .join(", ");
    const agentList =
      trace.agentSkills.length > 0
        ? trace.agentSkills
            .map((s) => `${s.skillName}${s.skillLevel ? ` (level ${s.skillLevel})` : ""}`)
            .join(", ")
        : "none recorded";
    skillsExplanation = `The routing config required the following skills: **${requiredList}**. ${trace.agentName}'s skills at time of routing: ${agentList}.`;

    const requiredNames = new Set(trace.requiredSkills.map((s) => s.skillName));
    const agentNames = new Set(trace.agentSkills.map((s) => s.skillName));
    const missing = Array.from(requiredNames).filter((n) => !agentNames.has(n));
    if (missing.length > 0) {
      flags.push({
        type: "warning",
        message: `Agent skill mismatch: required skills [${missing.join(", ")}] were not recorded on the assigned agent.`,
      });
    }
  } else if (trace.routingModel === "ExternalRouting") {
    skillsExplanation = null;
  } else {
    skillsExplanation = `No skill requirements were configured for this routing config. Any available agent in the queue was eligible.`;
  }

  // --- Capacity explanation ---
  const capacityExplanation =
    trace.capacityWeight != null
      ? `This work item consumed **${trace.capacityWeight} capacity unit(s)**${trace.capacityPercentage != null ? ` (${trace.capacityPercentage}% of capacity)` : ""} when assigned.`
      : "Capacity weight data was not available for this routing event.";

  // --- Timing flags ---
  if (trace.timeToAcceptSeconds != null) {
    if (trace.timeToAcceptSeconds > 300) {
      flags.push({
        type: "warning",
        message: `Long time to accept: ${secondsToHuman(trace.timeToAcceptSeconds)}. This may indicate the queue was understaffed or agent capacity weights are too high.`,
      });
    }
  } else {
    flags.push({
      type: "info",
      message: "This work item has not been accepted yet, or accept time was not recorded.",
    });
  }

  // --- Capacity pressure flag ---
  if (trace.capacityPercentage != null && trace.capacityPercentage >= 90) {
    flags.push({
      type: "warning",
      message: `Agent was near full capacity (${trace.capacityPercentage}%) when assigned. Consider reviewing capacity weights or agent workload.`,
    });
  }

  // --- Summary ---
  const acceptedIn =
    trace.timeToAcceptSeconds != null
      ? ` ${trace.agentName} accepted in ${secondsToHuman(trace.timeToAcceptSeconds)}.`
      : "";

  const summary =
    `This ${trace.workItemType} came in through the **${trace.channelLabel}** channel ` +
    `into the **${trace.queueName}** queue. ` +
    `Using the **${modelLabel}** routing model, Omni-Channel assigned it to **${trace.agentName}**.` +
    acceptedIn;

  return {
    summary,
    routingModelExplanation,
    agentSelectionExplanation,
    skillsExplanation,
    capacityExplanation,
    flags,
  };
}

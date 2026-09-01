// ─── Claude API integration ───────────────────────────────────────────────────
// All Claude calls go through this module.
//
// PRIVACY ENFORCEMENT: Every call to callClaude() uses only data
// that has been through buildSafePayload() from data-guard.ts first.
// Customer data (Case, Contact, VoiceCall, MessagingSession fields)
// must never reach this module.
//
// If no API key is configured, all functions return deterministic
// fallback responses so the app works without a Claude subscription.

import {
  RoutingTrace,
  RoutingExplanation,
  CorrectionInput,
  ConfigSuggestion,
  RoutingChain,
} from "./types";
import { SynopsisData } from "./sf-synopsis";

// Check once at startup whether a real API key is present.
// "your_anthropic_api_key" is the placeholder in .env.local.example — treat it as absent.
const hasApiKey =
  !!process.env.ANTHROPIC_API_KEY &&
  process.env.ANTHROPIC_API_KEY !== "your_anthropic_api_key";

// ─── Internal helper ──────────────────────────────────────────────────────────

// Sends a single-turn prompt to the Claude API and returns the text response.
// Uses dynamic import so the Anthropic SDK is only loaded when actually needed.
async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

// ─── Deterministic fallbacks ──────────────────────────────────────────────────

// Used when no API key is available — assembles the explanation sections
// from the already-computed RoutingExplanation into a plain-text narration.
function buildDeterministicNarration(
  trace: RoutingTrace,
  explanation: RoutingExplanation,
): string {
  const parts: string[] = [explanation.summary];
  parts.push(explanation.routingModelExplanation);
  if (explanation.skillsExplanation) parts.push(explanation.skillsExplanation);
  parts.push(explanation.capacityExplanation);
  return parts.join("\n\n");
}

// ─── narrateRouting ───────────────────────────────────────────────────────────

// Asks Claude to write a plain-English narration for a routing trace.
// The prompt is built from the safe payload only — no customer fields.
// Falls back to the deterministic narration if Claude is unavailable.
export async function narrateRouting(
  trace: RoutingTrace,
  explanation: RoutingExplanation,
): Promise<string> {
  if (!hasApiKey) {
    return buildDeterministicNarration(trace, explanation);
  }

  // Strip customer data before building the prompt
  const { buildSafePayload } = await import("./data-guard");
  const safePayload = buildSafePayload(trace);

  const prompt = `You are a Salesforce Omni-Channel routing expert helping a Salesforce admin understand a routing decision.

Here is the routing data for a work item (all customer data has been excluded — this contains only routing infrastructure metadata and agent information):

${JSON.stringify(safePayload, null, 2)}

Write a clear, concise plain-English explanation of why this work item was routed this way. Cover:
- What channel and queue it came through
- The routing type (QueueBased, SkillsBased, OmniFlow, or ExternalRouting) and what it means
- If ExternalRouting: make clear that Salesforce did NOT control this routing decision
- Which agent-selection model was active (LeastActive or MostAvailable) if applicable
- Why this specific agent was selected
- Any skills involved
- How long it took to accept (if available)

Write 2-4 short paragraphs. Be factual — only state what the data shows. Do not speculate about customer information.`;

  try {
    return await callClaude(prompt, 600);
  } catch {
    // Any Claude error (network, rate limit, etc.) falls back to deterministic output
    return buildDeterministicNarration(trace, explanation);
  }
}

// ─── narrateSynopsis ──────────────────────────────────────────────────────────

// Asks Claude to summarize an org's Omni-Channel configuration in plain English.
// The synopsis data contains only routing configuration — no customer records.
export async function narrateSynopsis(synopsis: SynopsisData): Promise<string> {
  if (!hasApiKey) return buildDeterministicSynopsis(synopsis);

  const prompt = `You are a Salesforce Omni-Channel expert. Summarize this org's routing setup in plain English for an admin.

Data (routing config only — no customer data):
${JSON.stringify(synopsis, null, 2)}

Write 3-5 short paragraphs covering:
- What channels are configured and their routing models
- How many queues and routing configs exist
- Whether skills-based routing is in use
- Presence/availability configuration
- Overall assessment: is this a simple or complex setup?

Be factual and concise. Do not speculate beyond the data.`;

  try {
    return await callClaude(prompt, 800);
  } catch {
    return buildDeterministicSynopsis(synopsis);
  }
}

// Deterministic synopsis fallback — used when no API key is configured.
function buildDeterministicSynopsis(synopsis: SynopsisData): string {
  const parts: string[] = [];
  parts.push(
    `This org has ${synopsis.channels.length} service channel(s) configured: ${synopsis.channels.map((c) => c.label).join(", ") || "none"}.`,
  );
  const queueCount =
    synopsis.queues !== null
      ? `${synopsis.queues.length}`
      : "an unknown number of";
  const configCount =
    synopsis.routingConfigs !== null
      ? `${synopsis.routingConfigs.length}`
      : "an unknown number of";
  parts.push(
    `There are ${queueCount} Omni-Channel queue(s) and ${configCount} routing configuration(s). Each queue is linked to a routing config that controls agent selection.`,
  );
  if (synopsis.skills.length > 0) {
    parts.push(
      `Skills-based routing is in use with ${synopsis.skills.length} skill(s) defined: ${synopsis.skills
        .map((s) => s.name)
        .slice(0, 5)
        .join(", ")}${synopsis.skills.length > 5 ? "…" : ""}.`,
    );
  } else {
    parts.push("No skills are configured — routing is queue-based only.");
  }
  const presenceCount =
    synopsis.presenceConfigs !== null
      ? synopsis.presenceConfigs.length
      : "an unknown number of";
  parts.push(
    `${presenceCount} presence configuration(s) control agent availability.`,
  );
  parts.push(
    `There are ${synopsis.agentCount} active standard users in this org. Not all may be Omni-Channel agents.`,
  );
  return parts.join("\n\n");
}

// ─── suggestConfiguration ─────────────────────────────────────────────────────

// Given a routing trace and an admin's correction (who it should have gone to),
// generates a list of concrete Salesforce config changes to fix the misrouting.
// Falls back to a deterministic rule-based suggestion when no API key is available.
export async function suggestConfiguration(
  trace: RoutingTrace,
  correction: CorrectionInput,
): Promise<ConfigSuggestion> {
  if (!hasApiKey) {
    return buildDeterministicSuggestion(trace, correction);
  }

  const { buildSafePayload } = await import("./data-guard");
  const safePayload = buildSafePayload(trace);

  const prompt = `You are a Salesforce Omni-Channel configuration expert. An admin flagged a misrouted work item.

Routing data: ${JSON.stringify(safePayload)}

Actual routing: agent=${trace.agentName}, queue=${trace.queueName}, model=${trace.routingModel}
Intended routing: agent=${correction.targetAgentName ?? "not specified"}, queue=${correction.targetQueueName ?? "not specified"}
Admin reason: ${correction.reason ?? "not provided"}

Reply with ONLY a JSON object, no markdown, no explanation outside the JSON:
{"likelyCause":"...","suggestedChanges":[{"area":"...","currentValue":"...","suggestedValue":"...","rationale":"..."}],"flowNote":null,"confidence":"High"}

Keep each string value short (under 100 characters). Use at most 3 suggestedChanges.`;

  try {
    const text = await callClaude(prompt, 800);
    // Strip any markdown code fences Claude may have added despite instructions
    const stripped = text
      .replace(/```(?:json)?\s*/g, "")
      .replace(/```/g, "")
      .trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON found");
    // Remove trailing commas to handle slightly malformed JSON from the model
    const cleaned = jsonMatch[0].replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(cleaned) as ConfigSuggestion;
  } catch {
    // If Claude's response can't be parsed, fall back to the rule-based suggestion
    return buildDeterministicSuggestion(trace, correction);
  }
}

// Rule-based suggestion — covers the most common misrouting causes
// based on routing model, queue membership, and skill gaps.
function buildDeterministicSuggestion(
  trace: RoutingTrace,
  correction: CorrectionInput,
): ConfigSuggestion {
  const suggestedChanges = [];

  const wantedDifferentQueue =
    correction.targetQueueId && correction.targetQueueId !== trace.queueName;
  const wantedDifferentAgent =
    correction.targetAgentName &&
    correction.targetAgentName !== trace.agentName;

  if (wantedDifferentQueue) {
    suggestedChanges.push({
      area: "Queue Membership",
      currentValue: `Work item routed to: ${trace.queueName}`,
      suggestedValue: `Should route to: ${correction.targetQueueName ?? "specified queue"}`,
      rationale:
        "Verify the work item's channel is mapped to the correct queue in Omni-Channel routing configuration.",
    });
  }

  if (wantedDifferentAgent) {
    // If skills are required, the intended agent may simply lack them
    if (trace.requiredSkills.length > 0) {
      suggestedChanges.push({
        area: "Skill Requirements",
        currentValue: `Required: ${trace.requiredSkills.map((s) => s.skillName).join(", ")}`,
        suggestedValue: `Verify ${correction.targetAgentName} has these skills assigned`,
        rationale:
          "The intended agent may lack the required skills on their profile, causing Omni-Channel to skip them during routing.",
      });
    }

    // Least Active vs Most Available is a common source of confusion
    if (trace.routingModel === "LeastActive") {
      suggestedChanges.push({
        area: "Routing Model",
        currentValue: "LeastActive",
        suggestedValue: "Consider MostAvailable",
        rationale:
          "Least Active routes to the agent with fewest open items regardless of capacity. If the intended agent had more items but more capacity, Most Available may route to them instead.",
      });
    }

    // High capacity weight can make an otherwise-eligible agent appear at capacity
    if (trace.capacityWeight != null && trace.capacityWeight > 1) {
      suggestedChanges.push({
        area: "Capacity Weight",
        currentValue: `Current capacity weight: ${trace.capacityWeight}`,
        suggestedValue: "Review capacity weight on this routing config",
        rationale:
          "A high capacity weight means each item blocks more capacity. If the intended agent was near their limit, lowering the weight could make them eligible.",
      });
    }
  }

  // Generic fallback when we don't have enough info to make a specific suggestion
  if (suggestedChanges.length === 0) {
    suggestedChanges.push({
      area: "Routing Configuration",
      currentValue: `Model: ${trace.routingModel}, Queue: ${trace.queueName}`,
      suggestedValue: "Review queue membership and agent availability settings",
      rationale:
        "Without more context, review that the intended agent is a member of the target queue and has the required skills assigned in Omni-Channel settings.",
    });
  }

  const likelyCause = correction.reason
    ? `Based on your input: "${correction.reason}". `
    : "" +
      `The work item was routed to ${trace.agentName} via the ${trace.routingModel} model in the ${trace.queueName} queue. ` +
      (wantedDifferentAgent
        ? `The intended agent (${correction.targetAgentName}) was likely unavailable, at capacity, or lacked required skills at the time of routing.`
        : "The routing config may need adjustment to reach the intended queue.");

  return {
    likelyCause,
    suggestedChanges,
    // Always mention Flow as a possible hidden routing layer
    flowNote:
      "If your org uses an Omni-Channel Flow, check the flow in Flow Builder (Setup → Flows) for any routing steps that may be directing work before it reaches the queue.",
    confidence: "Medium",
  };
}

// ─── narrateChain ─────────────────────────────────────────────────────────────

// Safe payload shape for a routing chain — customer-identifying fields omitted.
interface ChainSafePayload {
  workItemType: string;
  channelLabel: string;
  chainFlags: RoutingChain["chainFlags"];
  legs: Array<{
    queueName: RoutingChain["legs"][number]["queueName"];
    agentName: RoutingChain["legs"][number]["agentName"];
    agentUsername: RoutingChain["legs"][number]["agentUsername"];
    routingModel: RoutingChain["legs"][number]["routingModel"];
    routingType: RoutingChain["legs"][number]["routingType"];
    isAI: RoutingChain["legs"][number]["isAI"];
    timeToAcceptSeconds: RoutingChain["legs"][number]["timeToAcceptSeconds"];
    status: RoutingChain["legs"][number]["status"];
    agentSkills: RoutingChain["legs"][number]["agentSkills"];
    requiredSkills: RoutingChain["legs"][number]["requiredSkills"];
    flags: RoutingChain["legs"][number]["flags"];
  }>;
}

// Asks Claude to narrate a multi-leg routing chain in plain English.
// Builds a safe payload from the chain — private/customer-identifying fields
// (sfWorkItemId, customer, instanceUrl, entryAgentWorkId) are never included.
// Falls back to a deterministic narrative when no API key is available or
// when the Claude call fails.
export async function narrateChain(chain: RoutingChain): Promise<string> {
  // Build a safe payload — only routing infrastructure metadata is included.
  const safePayload: ChainSafePayload = {
    workItemType: chain.workItemType,
    channelLabel: chain.legs[0]?.channelLabel ?? "Unknown",
    chainFlags: chain.chainFlags,
    legs: chain.legs.map((leg) => ({
      queueName: leg.queueName,
      agentName: leg.agentName,
      agentUsername: leg.agentUsername,
      routingModel: leg.routingModel,
      routingType: leg.routingType,
      isAI: leg.isAI,
      timeToAcceptSeconds: leg.timeToAcceptSeconds,
      status: leg.status,
      agentSkills: leg.agentSkills,
      requiredSkills: leg.requiredSkills,
      flags: leg.flags,
    })),
  };

  if (!hasApiKey) {
    return buildDeterministicChainNarrative(safePayload);
  }

  const prompt = `You are a Salesforce Omni-Channel routing expert helping a Salesforce admin understand a multi-leg routing chain.

A routing chain occurs when a work item passes through more than one routing leg — for example, when it is initially handled by an AI agent and then escalated to a human agent, or when it is transferred between queues.

Here is the routing chain data (all customer data has been excluded — this contains only routing infrastructure metadata and agent information):

${JSON.stringify(safePayload, null, 2)}

Write a clear, concise plain-English narration of how this ${safePayload.workItemType} was routed across all ${safePayload.legs.length} leg(s). Cover:
- The channel it arrived on
- Each leg in sequence: whether it was handled by an AI or human agent, which queue and routing type were used, and how long acceptance took
- Any escalation or transfer events between legs
- Any flags or notable conditions (from chainFlags or per-leg flags)
- The final outcome (accepted, declined, etc.)

Write 2-4 short paragraphs. Be factual — only state what the data shows.`;

  try {
    return await callClaude(prompt, 600);
  } catch {
    return buildDeterministicChainNarrative(safePayload);
  }
}

// Deterministic chain narrative — used when no API key is configured or Claude fails.
// Produces a readable summary directly from the safe payload fields.
function buildDeterministicChainNarrative(
  safePayload: ChainSafePayload,
): string {
  const { workItemType, legs, chainFlags } = safePayload;
  const legCount = legs.length;

  const parts: string[] = [];
  parts.push(
    `This ${workItemType} had ${legCount} routing leg${legCount === 1 ? "" : "s"}.`,
  );

  legs.forEach((leg, index) => {
    const legNum = index + 1;
    const agentKind = leg.isAI ? "AI" : "Human";
    const queuePart = leg.queueName ? ` via ${leg.queueName}` : "";
    const routingPart = leg.routingType ? ` using ${leg.routingType}` : "";
    const agentPart = leg.agentName ? ` (${leg.agentName})` : "";
    const timePart =
      leg.timeToAcceptSeconds != null
        ? ` Accepted in ${leg.timeToAcceptSeconds}s.`
        : "";

    let legText = `Leg ${legNum}: ${agentKind} agent${agentPart} handled${queuePart}${routingPart}.${timePart}`;

    // Surface any per-leg flags
    if (leg.flags && leg.flags.length > 0) {
      const flagMessages = leg.flags
        .map((f: { message: string }) => f.message)
        .join(" ");
      legText += ` Note: ${flagMessages}`;
    }

    // Escalation hint when a subsequent leg follows
    if (index < legCount - 1) {
      const nextLeg = legs[index + 1];
      const escalationTarget = nextLeg.agentName
        ? nextLeg.agentName
        : nextLeg.queueName
          ? nextLeg.queueName
          : "the next leg";
      legText += ` Escalated to Leg ${legNum + 1}: ${escalationTarget}.`;
    }

    parts.push(legText);
  });

  // Surface chain-level flags if present
  if (chainFlags && chainFlags.length > 0) {
    const chainFlagMessages = chainFlags
      .map((f: { message: string }) => f.message)
      .join(" ");
    parts.push(`Chain-level notes: ${chainFlagMessages}`);
  }

  return parts.join(" ");
}

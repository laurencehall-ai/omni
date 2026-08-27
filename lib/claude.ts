import { RoutingTrace, RoutingExplanation, CorrectionInput, ConfigSuggestion } from "./types";
import { SynopsisData } from "./sf-synopsis";

const hasApiKey = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "your_anthropic_api_key";

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

// Builds a plain-English narration from the deterministic explanation — no LLM needed.
function buildDeterministicNarration(trace: RoutingTrace, explanation: RoutingExplanation): string {
  const parts: string[] = [explanation.summary];
  parts.push(explanation.routingModelExplanation);
  if (explanation.skillsExplanation) parts.push(explanation.skillsExplanation);
  parts.push(explanation.capacityExplanation);
  return parts.join("\n\n");
}

export async function narrateRouting(
  trace: RoutingTrace,
  explanation: RoutingExplanation
): Promise<string> {
  if (!hasApiKey) {
    return buildDeterministicNarration(trace, explanation);
  }

  const { buildSafePayload } = await import("./data-guard");
  const safePayload = buildSafePayload(trace);

  const prompt = `You are a Salesforce Omni-Channel routing expert helping a Salesforce admin understand a routing decision.

Here is the routing data for a work item (all customer data has been excluded — this contains only routing infrastructure metadata and agent information):

${JSON.stringify(safePayload, null, 2)}

Write a clear, concise plain-English explanation of why this work item was routed this way. Cover:
- What channel and queue it came through
- Which routing model was active and how it works
- Why this specific agent was selected
- Any skills involved
- How long it took to accept (if available)

Write 2-4 short paragraphs. Be factual — only state what the data shows. Do not speculate about customer information.`;

  try {
    return await callClaude(prompt, 600);
  } catch {
    return buildDeterministicNarration(trace, explanation);
  }
}

// Deterministic suggestion engine — used when no API key is available.
function buildDeterministicSuggestion(
  trace: RoutingTrace,
  correction: CorrectionInput
): ConfigSuggestion {
  const suggestedChanges = [];

  const wantedDifferentQueue =
    correction.targetQueueId && correction.targetQueueId !== trace.queueName;
  const wantedDifferentAgent =
    correction.targetAgentName && correction.targetAgentName !== trace.agentName;

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
    if (trace.requiredSkills.length > 0) {
      suggestedChanges.push({
        area: "Skill Requirements",
        currentValue: `Required: ${trace.requiredSkills.map((s) => s.skillName).join(", ")}`,
        suggestedValue: `Verify ${correction.targetAgentName} has these skills assigned`,
        rationale:
          "The intended agent may lack the required skills on their profile, causing Omni-Channel to skip them during routing.",
      });
    }

    if (trace.routingModel === "LeastActive") {
      suggestedChanges.push({
        area: "Routing Model",
        currentValue: "LeastActive",
        suggestedValue: "Consider MostAvailable",
        rationale:
          "Least Active routes to the agent with fewest open items regardless of capacity. If the intended agent had more items but more capacity, Most Available may route to them instead.",
      });
    }

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

  if (suggestedChanges.length === 0) {
    suggestedChanges.push({
      area: "Routing Configuration",
      currentValue: `Model: ${trace.routingModel}, Queue: ${trace.queueName}`,
      suggestedValue: "Review queue membership and agent availability settings",
      rationale:
        "Without more context, review that the intended agent is a member of the target queue and has the required skills assigned in Omni-Channel settings.",
    });
  }

  const likelyCause =
    correction.reason
      ? `Based on your input: "${correction.reason}". `
      : "" +
        `The work item was routed to ${trace.agentName} via the ${trace.routingModel} model in the ${trace.queueName} queue. ` +
        (wantedDifferentAgent
          ? `The intended agent (${correction.targetAgentName}) was likely unavailable, at capacity, or lacked required skills at the time of routing.`
          : "The routing config may need adjustment to reach the intended queue.");

  return {
    likelyCause,
    suggestedChanges,
    flowNote:
      "If your org uses an Omni-Channel Flow, check the flow in Flow Builder (Setup → Flows) for any routing steps that may be directing work before it reaches the queue.",
    confidence: "Medium",
  };
}

function buildDeterministicSynopsis(synopsis: SynopsisData): string {
  const parts: string[] = [];
  parts.push(`This org has ${synopsis.channels.length} service channel(s) configured: ${synopsis.channels.map(c => c.label).join(", ") || "none"}.`);
  parts.push(`There are ${synopsis.queues.length} queue(s) and ${synopsis.routingConfigs.length} routing configuration(s).`);
  if (synopsis.skills.length > 0) {
    parts.push(`Skills-based routing is in use with ${synopsis.skills.length} skill(s) defined: ${synopsis.skills.map(s => s.name).slice(0, 5).join(", ")}${synopsis.skills.length > 5 ? "…" : ""}.`);
  } else {
    parts.push("No skills are configured — routing is queue-based only.");
  }
  parts.push(`${synopsis.presenceConfigs.length} presence configuration(s) control agent availability.`);
  parts.push(`Approximately ${synopsis.agentCount} active agent(s) are configured in this org.`);
  return parts.join("\n\n");
}

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

export async function suggestConfiguration(
  trace: RoutingTrace,
  correction: CorrectionInput
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
    const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON found");
    const cleaned = jsonMatch[0].replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(cleaned) as ConfigSuggestion;
  } catch {
    // Fall back to deterministic suggestion if Claude response can't be parsed
    return buildDeterministicSuggestion(trace, correction);
  }
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RoutingChain,
  RoutingLeg,
  RoutingTrace,
  CorrectionInput,
  ConfigSuggestion,
} from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/utils";
import { markValidated, markFlagged } from "@/lib/validations";
import CorrectionPanel from "@/components/CorrectionPanel";
import SuggestionPanel from "@/components/SuggestionPanel";
import DataPanel from "@/components/DataPanel";
import SubwayMap from "@/components/SubwayMap";
import Confetti from "@/components/Confetti";

interface TraceResult {
  chain: RoutingChain;
  narration: string;
}

type Verdict = "correct" | "incorrect" | null;

// ─── Routing type badge ───────────────────────────────────────────────────────

const ROUTING_TYPE_BADGES: Record<string, { label: string; color: string }> = {
  QueueBased: {
    label: "Queue",
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  SkillsBased: {
    label: "Skills",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  ExternalRouting: {
    label: "External",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  OmniFlow: {
    label: "Flow",
    color: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  },
};

function routingTypeBadge(rt: string | null) {
  if (!rt)
    return {
      label: "Unknown",
      color:
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    };
  return (
    ROUTING_TYPE_BADGES[rt] ?? {
      label: rt,
      color:
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    }
  );
}

// ─── legToTrace adapter ───────────────────────────────────────────────────────
// DataPanel and SubwayMap still expect a RoutingTrace — derived from a leg + chain.

function legToTrace(leg: RoutingLeg, chain: RoutingChain): RoutingTrace {
  return {
    workItemId: chain.entryAgentWorkId,
    sfWorkItemId: chain.sfWorkItemId,
    workItemType: chain.workItemType,
    customer: chain.customer,
    instanceUrl: chain.instanceUrl,
    channelLabel: leg.channelLabel,
    queueName: leg.queueName,
    agentName: leg.agentName,
    agentUsername: leg.agentUsername,
    routingModel: leg.routingModel,
    routingType: leg.routingType,
    capacityWeight: leg.capacityWeight,
    capacityPercentage: leg.capacityPercentage,
    createdDate: leg.createdDate,
    acceptDateTime: leg.acceptDateTime,
    timeToAcceptSeconds: leg.timeToAcceptSeconds,
    routingConfigName: null,
    routingConfigPriority: leg.routingConfigPriority,
    requiredSkills: leg.requiredSkills,
    agentSkills: leg.agentSkills,
    status: leg.status,
  };
}

// ─── Chain node types ─────────────────────────────────────────────────────────
// Each node represents one discrete event in the routing journey.
// Nodes with placeholder: true are skeleton entries for Phase 3 data.

interface ChainNode {
  id: string;
  type: "channel-entry" | "omniflow" | "agent-work" | "escalation";
  placeholder?: boolean;
  // agent-work
  leg?: RoutingLeg;
  // channel-entry
  channelLabel?: string;
  phone?: string | null;
  createdDate?: string;
  // omniflow
  context?: "initial" | "escalation";
  // escalation
  timestamp?: string;
  fromAgentName?: string;
  toQueueName?: string;
}

function buildChainNodes(chain: RoutingChain): ChainNode[] {
  const nodes: ChainNode[] = [];

  // 1. Channel entry — always the first node
  nodes.push({
    id: "channel-entry",
    type: "channel-entry",
    channelLabel: chain.legs[0]?.channelLabel ?? "Unknown",
    phone: chain.customer?.phone ?? null,
    createdDate: chain.legs[0]?.createdDate,
  });

  // 2. Initial routing flow placeholder — Voice and Messaging almost always
  //    pass through an OmniFlow before AgentWork is created.
  const likelyHasInitialFlow =
    chain.legs.some((l) => l.routingType === "OmniFlow") ||
    chain.workItemType === "Voice Call" ||
    chain.workItemType === "Messaging Session";
  if (likelyHasInitialFlow) {
    nodes.push({
      id: "omniflow-initial",
      type: "omniflow",
      placeholder: true,
      context: "initial",
    });
  }

  // 3. AgentWork legs with escalation placeholders between AI→human transitions
  for (let i = 0; i < chain.legs.length; i++) {
    const leg = chain.legs[i];
    nodes.push({ id: leg.agentWorkId, type: "agent-work", leg });

    if (i < chain.legs.length - 1) {
      const next = chain.legs[i + 1];
      if (leg.isAI && !next.isAI) {
        nodes.push({
          id: `escalation-${i}`,
          type: "escalation",
          placeholder: true,
          timestamp: next.createdDate,
          fromAgentName: leg.agentName,
          toQueueName: next.queueName,
        });
      }
    }
  }

  return nodes;
}

function nodeDotColor(node: ChainNode): string {
  if (node.type === "channel-entry") return "bg-blue-500 dark:bg-blue-400";
  if (node.type === "omniflow") return "bg-pink-400 dark:bg-pink-500";
  if (node.type === "escalation") return "bg-red-500 dark:bg-red-400";
  if (node.type === "agent-work")
    return node.leg?.isAI
      ? "bg-blue-400 dark:bg-blue-500"
      : "bg-blue-500 dark:bg-blue-400";
  return "bg-blue-400";
}

// ─── ChainNodeCard ────────────────────────────────────────────────────────────

function ChainNodeCard({
  node,
  isExpanded,
  onToggle,
  isEntry,
  chain,
}: {
  node: ChainNode;
  isExpanded: boolean;
  onToggle: () => void;
  isEntry: boolean;
  chain: RoutingChain;
}) {
  const badge =
    node.type === "agent-work" && node.leg
      ? routingTypeBadge(node.leg.routingType)
      : null;

  function CollapsedSummary() {
    if (node.type === "channel-entry") {
      return (
        <div className="flex items-center gap-2 flex-wrap min-w-0 text-sm">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Channel Entry
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-slate-600 dark:text-slate-400">
            {node.channelLabel}
          </span>
          {node.phone && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">
                {node.phone}
              </span>
            </>
          )}
          {node.createdDate && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatDate(node.createdDate)}
              </span>
            </>
          )}
        </div>
      );
    }

    if (node.type === "omniflow") {
      return (
        <div className="flex items-center gap-2 flex-wrap min-w-0 text-sm">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Omni-Channel Flow
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-slate-500 dark:text-slate-400">
            {node.context === "initial"
              ? "Initial routing decision"
              : "Escalation flow"}
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Phase 3
          </span>
        </div>
      );
    }

    if (node.type === "agent-work" && node.leg) {
      const leg = node.leg;
      return (
        <div className="flex items-center gap-2 flex-wrap min-w-0 text-sm">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {leg.isAI ? "AI Agent" : "Human Agent"}
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-slate-700 dark:text-slate-300">
            {leg.agentName}
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-slate-500 dark:text-slate-400">
            {leg.queueName}
          </span>
          {leg.timeToAcceptSeconds != null && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                accepted in {formatDuration(leg.timeToAcceptSeconds)}
              </span>
            </>
          )}
          {badge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
            >
              {badge.label}
            </span>
          )}
        </div>
      );
    }

    if (node.type === "escalation") {
      return (
        <div className="flex items-center gap-2 flex-wrap min-w-0 text-sm">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Escalation
          </span>
          {node.timestamp && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-slate-500 dark:text-slate-400">
                at {formatDate(node.timestamp)}
              </span>
            </>
          )}
          {node.fromAgentName && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-slate-500 dark:text-slate-400">
                from {node.fromAgentName}
              </span>
            </>
          )}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Phase 3
          </span>
        </div>
      );
    }

    return null;
  }

  function ExpandedDetail() {
    if (node.type === "channel-entry") {
      return (
        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          <p>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Channel:
            </span>{" "}
            {node.channelLabel}
          </p>
          {node.phone ? (
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                From:
              </span>{" "}
              <span className="font-mono">{node.phone}</span>
            </p>
          ) : (
            <p className="italic text-slate-400 dark:text-slate-500">
              Customer phone number not available.
            </p>
          )}
          {node.createdDate && (
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Arrived:
              </span>{" "}
              {formatDate(node.createdDate)}
            </p>
          )}
        </div>
      );
    }

    if (node.type === "omniflow") {
      return (
        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <p>
            {node.context === "initial"
              ? `An Omni-Channel Flow routed this ${chain.workItemType} before the first AgentWork record was created. The flow evaluated conditions — such as IVR keypress, business hours, or queue availability — to determine the routing path.`
              : "An escalation flow ran at this point to transfer the work item to the next queue or agent."}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500">
            ⚡ Flow name, decision nodes, branch conditions, and alternate paths
            will be surfaced in Phase 3.
          </p>
        </div>
      );
    }

    if (node.type === "agent-work" && node.leg) {
      const leg = node.leg;
      return (
        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">
                Queue
              </p>
              <p className="font-medium text-slate-900 dark:text-white">
                {leg.queueName}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">
                Status
              </p>
              <p
                className={`font-medium ${leg.status === "Opened" ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-300"}`}
              >
                {leg.status}
              </p>
            </div>
            {leg.timeToAcceptSeconds != null && (
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">
                  Time to accept
                </p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {formatDuration(leg.timeToAcceptSeconds)}
                </p>
              </div>
            )}
            {leg.capacityWeight != null && (
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">
                  Capacity
                </p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {leg.capacityWeight} unit(s)
                  {leg.capacityPercentage != null
                    ? ` · ${leg.capacityPercentage}%`
                    : ""}
                </p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">
                Created
              </p>
              <p className="font-medium text-slate-900 dark:text-white">
                {formatDate(leg.createdDate)}
              </p>
            </div>
          </div>

          {leg.flags.length > 0 && (
            <div className="space-y-1">
              {leg.flags.map((f, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-1.5 text-xs px-2 py-1.5 rounded ${
                    f.type === "warning"
                      ? "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400"
                      : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                  }`}
                >
                  <span className="shrink-0">
                    {f.type === "warning" ? "⚠" : "ℹ"}
                  </span>
                  <span>{f.message}</span>
                </div>
              ))}
            </div>
          )}

          {leg.agentSkills.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">
                Agent skills
              </p>
              <div className="flex flex-wrap gap-1">
                {leg.agentSkills.map((s) => (
                  <span
                    key={s.skillName}
                    className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full"
                  >
                    {s.skillName}
                    {s.skillLevel ? ` L${s.skillLevel}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (node.type === "escalation") {
      return (
        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          {node.fromAgentName && (
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {node.fromAgentName}
              </span>{" "}
              initiated the escalation.
            </p>
          )}
          {node.toQueueName && (
            <p>
              Work item transferred to the{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {node.toQueueName}
              </span>{" "}
              queue.
            </p>
          )}
          {node.timestamp && (
            <p>
              Escalation recorded at{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {formatDate(node.timestamp)}
              </span>
              .
            </p>
          )}
          <p className="text-xs text-amber-600 dark:text-amber-500">
            ⚡ Escalation flow name and decision details will be surfaced in
            Phase 3.
          </p>
        </div>
      );
    }

    return null;
  }

  // Palette per node type — matches the dot color on the timeline
  function nodeStyle(): { border: string; bg: string; hover: string } {
    if (node.type === "channel-entry")
      return {
        border: "border-blue-300 dark:border-blue-700",
        bg: "bg-blue-100 dark:bg-blue-900/30",
        hover: "hover:border-blue-400 dark:hover:border-blue-600",
      };
    if (node.type === "omniflow")
      return {
        border: "border-pink-200 dark:border-pink-800/60",
        bg: "bg-pink-100 dark:bg-pink-900/30",
        hover: "hover:border-pink-300 dark:hover:border-pink-700",
      };
    if (node.type === "escalation")
      return {
        border: "border-red-200 dark:border-red-800/60",
        bg: "bg-red-100 dark:bg-red-900/30",
        hover: "hover:border-red-300 dark:hover:border-red-700",
      };
    // agent-work: both AI and human get blue (same dot color)
    return {
      border: "border-blue-200 dark:border-blue-800/60",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      hover: "hover:border-blue-300 dark:hover:border-blue-700",
    };
  }
  const { border, bg, hover } = nodeStyle();

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left border rounded-xl px-4 py-3 transition-colors ${border} ${bg} ${hover}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CollapsedSummary />
        </div>
        <span className="text-slate-400 dark:text-slate-600 text-xs shrink-0">
          {isExpanded ? "▲" : "▼"}
        </span>
      </div>
      {isExpanded && <ExpandedDetail />}
    </button>
  );
}

// ─── TracePage ────────────────────────────────────────────────────────────────

export default function TracePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  const [result, setResult] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [suggestion, setSuggestion] = useState<ConfigSuggestion | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showRawData, setShowRawData] = useState(false);
  const [showFullNarration, setShowFullNarration] = useState(false);
  const [showSubwayMap, setShowSubwayMap] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    fetch(`/api/trace?id=${id}`)
      .then((r) => {
        if (r.status === 401) {
          router.push("/connect");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.error) throw new Error(data.error);
        setResult(data);
        // Entry AgentWork leg starts expanded — hints to the user that nodes are clickable
        setExpandedNodes(new Set([data.chain.entryAgentWorkId]));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleCorrection = useCallback(
    async (correction: CorrectionInput) => {
      setSuggestLoading(true);
      setSuggestError(null);
      try {
        const res = await fetch("/api/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentWorkId: id, correction }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSuggestion(data);
      } catch (e) {
        setSuggestError(
          e instanceof Error ? e.message : "Failed to generate suggestion",
        );
      } finally {
        setSuggestLoading(false);
      }
    },
    [id],
  );

  function toggleNode(nodeId: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-mono">
          Tracing routing decision…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-16">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400 mb-4">
          {error}
        </div>
        <button
          onClick={() => router.back()}
          className="text-sm text-brand-500 hover:underline"
        >
          ← Back to work items
        </button>
      </div>
    );
  }

  if (!result) return null;

  const { chain, narration } = result;
  const entryLeg =
    chain.legs.find((l) => l.agentWorkId === chain.entryAgentWorkId) ??
    chain.legs[0];
  const lastLeg = chain.legs[chain.legs.length - 1];
  const entryTrace = legToTrace(entryLeg, chain);
  const chainNodes = buildChainNodes(chain);
  const allExpanded = expandedNodes.size === chainNodes.length;

  const workItemTitle = chain.customer?.caseNumber
    ? `Case ${chain.customer.caseNumber}`
    : `${chain.workItemType} ···${chain.sfWorkItemId.slice(-6).toUpperCase()}`;

  function channelDescriptor(): string | null {
    if (chain.workItemType === "Voice Call" && chain.customer?.phone)
      return `called ${chain.customer.phone}`;
    if (chain.workItemType === "Voice Call") return "incoming call";
    if (chain.workItemType === "Messaging Session")
      return `session via ${entryLeg.channelLabel}`;
    return null;
  }
  const descriptor = channelDescriptor();

  function outcomePill(): { label: string; color: string } {
    const hasEscalation =
      chain.legs.length > 1 &&
      chain.legs.some((l) => l.isAI) &&
      chain.legs.some((l) => !l.isAI);
    if (hasEscalation)
      return {
        label: "Escalated",
        color:
          "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
      };
    if (lastLeg.status === "Opened")
      return {
        label: "Active",
        color:
          "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
      };
    if (lastLeg.status === "Assigned")
      return {
        label: "Assigned",
        color:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      };
    return {
      label: lastLeg.status,
      color:
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    };
  }
  const outcome = outcomePill();

  // Collect all unique warnings across chain + legs for the tooltip icon
  const allWarnings = [
    ...chain.chainFlags.filter((f) => f.type === "warning"),
    ...chain.legs.flatMap((l) => l.flags).filter((f) => f.type === "warning"),
  ].reduce<typeof chain.chainFlags>((acc, f) => {
    if (!acc.some((x) => x.message === f.message)) acc.push(f);
    return acc;
  }, []);

  // Short tooltip summaries — plain one-liners for hover readability
  function warningTooltip(message: string): string {
    if (/external routing/i.test(message))
      return "External routing — Salesforce did not control this assignment";
    if (/BYOT/i.test(message) || /separate VoiceCall/i.test(message))
      return "BYOT architecture — human leg may be on a separate call record";
    if (/skill/i.test(message))
      return "Skill mismatch — agent skills may not satisfy routing requirements";
    if (/capacity/i.test(message))
      return "Capacity issue — agent may have been near their limit";
    // Fallback: truncate long messages to ~60 chars
    return message.length > 60 ? message.slice(0, 57) + "…" : message;
  }

  return (
    <div className="max-w-3xl mx-auto">
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}

      <button
        onClick={() => router.push("/work-items")}
        className="text-sm text-brand-500 hover:underline mb-4 block dark:text-brand-400"
      >
        ← Back to work items
      </button>

      {/* Header: work item name + pill strip */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          {workItemTitle}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {entryLeg.channelLabel}
          </span>
          {descriptor && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
              {descriptor}
            </span>
          )}
          {chain.legs.length > 1 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {chain.legs.length} legs
            </span>
          )}
          {outcome.label === "Escalated" &&
            (() => {
              const escalatingLeg = chain.legs.findLast((l) => l.isAI);
              return escalatingLeg ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {escalatingLeg.agentName}
                </span>
              ) : null;
            })()}
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${outcome.color}`}
          >
            {outcome.label}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            {lastLeg.agentName}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {formatDate(chain.legs[0].createdDate)}
          </span>
          {/* Warning icon — hover to see all warnings as a compact tooltip */}
          {allWarnings.length > 0 && (
            <div className="relative group">
              <button className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors text-xs font-bold">
                ⚠
              </button>
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 hidden group-hover:block w-64">
                <div className="bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl space-y-1.5">
                  {allWarnings.map((w, i) => (
                    <p key={i} className="leading-snug">
                      {warningTooltip(w.message)}
                    </p>
                  ))}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-700" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Routing Chain accordion */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-brand-500 rounded-full" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
              Routing Chain
            </h2>
          </div>
          <button
            onClick={() =>
              allExpanded
                ? setExpandedNodes(new Set())
                : setExpandedNodes(new Set(chainNodes.map((n) => n.id)))
            }
            className="text-xs text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>

        {/* Timeline: vertical line + nodes */}
        <div className="relative">
          <div className="absolute left-[5px] top-3 bottom-3 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            {chainNodes.map((node) => (
              <div key={node.id} className="relative flex items-start gap-3">
                {/* Dot on the timeline */}
                <div
                  className={`relative z-10 mt-3.5 w-2.5 h-2.5 rounded-full shrink-0 ${nodeDotColor(node)}`}
                />
                {/* Card */}
                <div className="flex-1 min-w-0">
                  <ChainNodeCard
                    node={node}
                    isExpanded={expandedNodes.has(node.id)}
                    onToggle={() => toggleNode(node.id)}
                    isEntry={node.id === chain.entryAgentWorkId}
                    chain={chain}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full narration — collapsible */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm mb-3">
        <button
          onClick={() => setShowFullNarration(!showFullNarration)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span>Full Explanation</span>
          <span className="text-slate-400">
            {showFullNarration ? "▲" : "▼"}
          </span>
        </button>
        {showFullNarration && (
          <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {narration}
            </p>
          </div>
        )}
      </div>

      {/* Raw data — collapsible */}
      <div className="mb-5">
        <button
          onClick={() => setShowRawData(!showRawData)}
          className="text-xs text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 font-mono"
        >
          {showRawData ? "▲ Hide" : "▼ Show"} raw routing data
        </button>
        {showRawData && (
          <div className="mt-3">
            <DataPanel
              trace={entryTrace}
              explanation={{
                summary: "",
                routingModelExplanation: "",
                agentSelectionExplanation: "",
                skillsExplanation: null,
                capacityExplanation: "",
                flags: entryLeg.flags,
              }}
            />
          </div>
        )}
      </div>

      {/* Verdict */}
      {verdict === null && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm mb-5">
          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Did this route correctly?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setVerdict("correct");
                setShowConfetti(true);
                markValidated(id);
              }}
              className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-400 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <span>👍</span> Yes, routed correctly
            </button>
            <button
              onClick={() => {
                setVerdict("incorrect");
                markFlagged(id);
              }}
              className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <span>👎</span> No, this was wrong
            </button>
          </div>
        </div>
      )}

      {verdict === "correct" && !showConfetti && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center animate-fade-in mb-5">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-green-800 dark:text-green-400 font-bold text-lg">
            Routing confirmed correct!
          </p>
          <p className="text-sm text-green-600 dark:text-green-500 mt-1">
            This route is validated and can serve as a baseline for testing your
            configuration.
          </p>
        </div>
      )}

      {verdict === "incorrect" && !suggestion && (
        <CorrectionPanel
          onSubmit={handleCorrection}
          loading={suggestLoading}
          error={suggestError}
        />
      )}

      {suggestion && <SuggestionPanel suggestion={suggestion} />}

      {/* Route Map — legacy visual, collapsed by default */}
      <div className="mt-6 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSubwayMap(!showSubwayMap)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900"
        >
          <span>Route Map</span>
          <span className="text-slate-400">{showSubwayMap ? "▲" : "▼"}</span>
        </button>
        {showSubwayMap && (
          <div className="bg-white dark:bg-slate-900 px-5 pb-5 border-t border-slate-100 dark:border-slate-800">
            <SubwayMap trace={entryTrace} />
          </div>
        )}
      </div>
    </div>
  );
}

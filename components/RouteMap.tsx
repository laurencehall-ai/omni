"use client";

import { useState, useEffect } from "react";
import { RoutingChain, RoutingLeg } from "@/lib/types";
import { FlowGraphWithPath } from "@/lib/flow-types";
import { formatDate, formatDuration } from "@/lib/utils";


// ─── Transfer type label ──────────────────────────────────────────────────────

function transferLabel(from: RoutingLeg, to: RoutingLeg): string {
  if (from.isAI && !to.isAI) return "AI → Human";
  if (!from.isAI && to.isAI) return "Human → AI";
  if (from.isAI && to.isAI) return "AI → AI";
  return "Human → Human";
}

// ─── Connector line with arrowhead ────────────────────────────────────────────

function Connector() {
  return (
    <div className="flex flex-col items-center gap-0">
      <div className="w-0.5 h-5 bg-gradient-to-b from-slate-300 to-slate-200 dark:from-slate-600 dark:to-slate-700" />
      <div className="text-[10px] text-slate-400 dark:text-slate-600 leading-none">
        ▼
      </div>
    </div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400 w-32 shrink-0 text-xs uppercase tracking-wide">
        {label}
      </span>
      <span className="font-semibold text-slate-900 dark:text-white font-mono text-xs">
        {value ?? "—"}
      </span>
    </div>
  );
}

// ─── Inbound Interaction box ──────────────────────────────────────────────────

function InboundBox({ chain, flowData }: { chain: RoutingChain; flowData: FlowData | null }) {
  const leg = chain.legs[0];

  // Prefer the routing type from the matched flow node (more accurate than AgentWork.RoutingType)
  let routingTypeLabel = leg?.routingType ?? "—";
  if (flowData) {
    const matchedNode = flowData.graph.nodes.find(
      (n) => n.name === flowData.graph.matchedRouteWorkName,
    );
    if (matchedNode?.routingType) {
      routingTypeLabel = matchedNode.routingType;
    }
    if (flowData.flowLabel) {
      routingTypeLabel += ` · via ${flowData.flowLabel}`;
    }
  }

  const rows: { label: string; value: string | null }[] = [
    { label: "Channel", value: leg?.channelLabel ?? "—" },
    { label: "Routing Type", value: routingTypeLabel },
    { label: "Platform Key", value: chain.customer?.phone ?? "—" },
    { label: "Routing Config", value: "—" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-brand-400 dark:border-brand-500 rounded-xl p-5 shadow-md">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 font-mono mb-3">
        ▶ Inbound Interaction
      </p>
      <div className="space-y-2.5">
        {rows.map(({ label, value }) => (
          <FieldRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

// ─── Routing Results box ──────────────────────────────────────────────────────

function RoutingResultsBox({
  leg,
  legIndex,
  totalLegs,
  instanceUrl,
  copilotLabel,
}: {
  leg: RoutingLeg;
  legIndex: number;
  totalLegs: number;
  instanceUrl: string;
  copilotLabel?: string | null;
}) {
  const sfLink = `${instanceUrl}/lightning/r/AgentWork/${leg.agentWorkId}/view`;

  // When the flow node names a Copilot agent, prefer that over the generic "Automated Process" name
  const agentDisplay = copilotLabel
    ? `${copilotLabel} (AI)`
    : leg.isAI
      ? `${leg.agentName} (AI)`
      : leg.agentName;

  const rows: { label: string; value: string | null }[] = [
    { label: "Queue / Skill(s)", value: leg.queueName || "—" },
    {
      label: "Agent",
      value: agentDisplay,
    },
    {
      label: "Date / Time",
      value: leg.createdDate ? formatDate(leg.createdDate) : "—",
    },
    {
      label: "Capacity Used",
      value:
        leg.capacityWeight != null
          ? `${leg.capacityWeight} unit${leg.capacityWeight !== 1 ? "s" : ""}${leg.capacityPercentage != null ? ` (${leg.capacityPercentage}%)` : ""}`
          : "—",
    },
  ];

  const warnings = leg.flags.filter((f) => f.type === "warning");

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">
            Routing Results
          </p>
          {totalLegs > 1 && (
            <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
              Leg {legIndex + 1}
            </span>
          )}
        </div>
        <a
          href={sfLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors border border-brand-200 dark:border-brand-800"
        >
          <span>View</span>
          <span>↗</span>
        </a>
      </div>
      <div className="space-y-2.5">
        {rows.map(({ label, value }) => (
          <FieldRow key={label} label={label} value={value} />
        ))}
        {leg.timeToAcceptSeconds != null && (
          <FieldRow
            label="Time to Accept"
            value={formatDuration(leg.timeToAcceptSeconds)}
          />
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 px-3 py-2 rounded-lg"
            >
              <span className="shrink-0">⚠</span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Transfer badge ───────────────────────────────────────────────────────────

function TransferBadge({ from, to }: { from: RoutingLeg; to: RoutingLeg }) {
  const label = transferLabel(from, to);
  const isEscalation = from.isAI && !to.isAI;
  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      <div className="text-[10px] text-slate-400 dark:text-slate-600 leading-none">
        ▼
      </div>
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full border font-mono whitespace-nowrap ${
            isEscalation
              ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          }`}
        >
          {label}
        </span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="text-[10px] text-slate-400 dark:text-slate-600 leading-none">
        ▼
      </div>
    </div>
  );
}

// ─── RouteMap ─────────────────────────────────────────────────────────────────

interface FlowData {
  graph: FlowGraphWithPath;
  flowLabel: string | null;
}

export default function RouteMap({ chain }: { chain: RoutingChain }) {
  const [flowData, setFlowData] = useState<FlowData | null>(null);

  useEffect(() => {
    fetch(`/api/flow?agentWorkId=${chain.entryAgentWorkId}`)
      .then((r) => r.json())
      .then((data: { notFound?: boolean; error?: string; graph?: FlowGraphWithPath; flowLabel?: string }) => {
        if (!data.notFound && !data.error && data.graph) {
          setFlowData({ graph: data.graph, flowLabel: data.flowLabel ?? null });
        }
      })
      .catch(() => {/* silently omit */});
  }, [chain.entryAgentWorkId]);

  return (
    <div className="space-y-3">
      {/* Block 1: Inbound Interaction */}
      <InboundBox chain={chain} flowData={flowData} />

      <Connector />

      {/* Block 3: Routing Results — one per leg */}
      {chain.legs.map((leg, i) => {
        // Resolve copilot name from matched flow node (first leg only)
        let copilotLabel: string | null = null;
        if (i === 0 && flowData) {
          const matchedNode = flowData.graph.nodes.find(
            (n) => n.name === flowData.graph.matchedRouteWorkName,
          );
          copilotLabel = matchedNode?.copilotLabel ?? null;
        }
        return (
        <div key={leg.agentWorkId}>
          {i > 0 && <TransferBadge from={chain.legs[i - 1]} to={leg} />}
          <RoutingResultsBox
            leg={leg}
            legIndex={i}
            totalLegs={chain.legs.length}
            instanceUrl={chain.instanceUrl}
            copilotLabel={copilotLabel}
          />
        </div>
        );
      })}
    </div>
  );
}

"use client";

// RouteMap — per-interaction routing diagram replacing the accordion timeline.
//
// Queue/Skills path: two boxes (Inbound Interaction + Routing Results per leg)
//   with a transfer badge between legs.
//
// OmniFlow path: same outer structure but a ReactFlow diagram replaces the
//   accordion between the Inbound Interaction box and the Routing Results boxes.
//   Flow structure is a Phase 3 placeholder until the Tooling API spike.

import { RoutingChain, RoutingLeg } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/utils";

// ─── Transfer type label ──────────────────────────────────────────────────────

function transferLabel(from: RoutingLeg, to: RoutingLeg): string {
  if (from.isAI && !to.isAI) return "AI → Human";
  if (!from.isAI && to.isAI) return "Human → AI";
  if (from.isAI && to.isAI) return "AI → AI";
  return "Human → Human";
}

// ─── Inbound Interaction box ──────────────────────────────────────────────────

function InboundBox({ chain }: { chain: RoutingChain }) {
  const leg = chain.legs[0];
  const rows: { label: string; value: string | null }[] = [
    { label: "Channel", value: leg?.channelLabel ?? "—" },
    { label: "Routing Type", value: leg?.routingType ?? "—" },
    {
      label: "Platform Key",
      value: chain.customer?.phone ?? "—",
    },
    { label: "Routing Config", value: "—" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-brand-300 dark:border-brand-700 rounded-xl p-5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono mb-3">
        Inbound Interaction
      </p>
      <div className="space-y-1.5">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400 w-28 shrink-0">
              {label}
            </span>
            <span className="font-medium text-slate-900 dark:text-white font-mono text-xs">
              {value ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Routing Results box ──────────────────────────────────────────────────────

function RoutingResultsBox({
  leg,
  instanceUrl,
}: {
  leg: RoutingLeg;
  instanceUrl: string;
}) {
  const sfLink = `${instanceUrl}/lightning/r/AgentWork/${leg.agentWorkId}/view`;

  const rows: { label: string; value: string | null }[] = [
    {
      label: "Queue / Skill(s)",
      value: leg.queueName || "—",
    },
    {
      label: "Agent",
      value: leg.isAI ? `${leg.agentName} (AI)` : leg.agentName,
    },
    {
      label: "Date / Time",
      value: leg.createdDate ? formatDate(leg.createdDate) : "—",
    },
    {
      label: "Capacity",
      value:
        leg.capacityWeight != null
          ? `${leg.capacityWeight} unit(s)${leg.capacityPercentage != null ? ` · ${leg.capacityPercentage}%` : ""}`
          : "—",
    },
  ];

  // Per-leg flags
  const warnings = leg.flags.filter((f) => f.type === "warning");

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">
          Routing Results
        </p>
        <a
          href={sfLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-brand-500 dark:text-brand-400 hover:underline"
        >
          View in Salesforce ↗
        </a>
      </div>
      <div className="space-y-1.5">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400 w-28 shrink-0">
              {label}
            </span>
            <span className="font-medium text-slate-900 dark:text-white font-mono text-xs">
              {value ?? "—"}
            </span>
          </div>
        ))}
        {leg.timeToAcceptSeconds != null && (
          <div className="flex items-baseline gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400 w-28 shrink-0">
              Time to Accept
            </span>
            <span className="font-medium text-slate-900 dark:text-white font-mono text-xs">
              {formatDuration(leg.timeToAcceptSeconds)}
            </span>
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 px-2 py-1.5 rounded"
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
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      <span
        className={`text-xs font-medium px-2.5 py-1 rounded-full border font-mono ${
          isEscalation
            ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
        }`}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

// ─── OmniFlow diagram (Phase 3 placeholder) ───────────────────────────────────
// Shows a minimal placeholder diagram until Tooling API flow introspection
// is implemented in Phase 3.

function OmniFlowPlaceholder() {
  return (
    <div className="bg-pink-50 dark:bg-pink-900/10 border border-dashed border-pink-300 dark:border-pink-800 rounded-xl p-6 text-center">
      <p className="text-sm font-semibold text-pink-700 dark:text-pink-400 mb-1">
        Omni-Channel Flow
      </p>
      <p className="text-xs text-pink-600 dark:text-pink-500 leading-relaxed max-w-xs mx-auto">
        Flow decision nodes and inferred path will be shown here in Phase 3
        (Tooling API). The routing results below reflect where the item actually
        landed.
      </p>
    </div>
  );
}

// ─── RouteMap ─────────────────────────────────────────────────────────────────

export default function RouteMap({ chain }: { chain: RoutingChain }) {
  const isOmniFlow = chain.legs.some((l) => l.routingType === "OmniFlow");

  return (
    <div className="space-y-3">
      {/* Block 1: Inbound Interaction */}
      <InboundBox chain={chain} />

      {/* Connector arrow */}
      <div className="flex justify-center">
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />
      </div>

      {/* Block 2: OmniFlow diagram (placeholder) or straight connector */}
      {isOmniFlow && (
        <>
          <OmniFlowPlaceholder />
          <div className="flex justify-center">
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />
          </div>
        </>
      )}

      {/* Block 3: Routing Results — one per leg, with transfer badges between */}
      {chain.legs.map((leg, i) => (
        <div key={leg.agentWorkId}>
          {i > 0 && (
            <>
              <div className="flex justify-center">
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
              </div>
              <TransferBadge from={chain.legs[i - 1]} to={leg} />
              <div className="flex justify-center">
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
              </div>
            </>
          )}
          <RoutingResultsBox leg={leg} instanceUrl={chain.instanceUrl} />
        </div>
      ))}
    </div>
  );
}

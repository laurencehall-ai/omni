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
import { formatDate } from "@/lib/utils";
import { markValidated, markFlagged } from "@/lib/validations";
import CorrectionPanel from "@/components/CorrectionPanel";
import SuggestionPanel from "@/components/SuggestionPanel";
import DataPanel from "@/components/DataPanel";
import RouteMap from "@/components/RouteMap";
import Confetti from "@/components/Confetti";

interface TraceResult {
  chain: RoutingChain;
  narration: string;
}

type Verdict = "correct" | "incorrect" | null;

// ─── legToTrace adapter ───────────────────────────────────────────────────────
// DataPanel still expects a RoutingTrace — derived from a leg + chain.

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
  const [showRawData, setShowRawData] = useState(false);
  const [showFullNarration, setShowFullNarration] = useState(false);
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

  // Collect all unique warnings across chain + legs
  const allWarnings = [
    ...chain.chainFlags.filter((f) => f.type === "warning"),
    ...chain.legs.flatMap((l) => l.flags).filter((f) => f.type === "warning"),
  ].reduce<typeof chain.chainFlags>((acc, f) => {
    if (!acc.some((x) => x.message === f.message)) acc.push(f);
    return acc;
  }, []);

  function warningTooltip(message: string): string {
    if (/external routing/i.test(message))
      return "External routing — Salesforce did not control this assignment";
    if (/BYOT/i.test(message) || /separate VoiceCall/i.test(message))
      return "BYOT architecture — human leg may be on a separate call record";
    if (/skill/i.test(message))
      return "Skill mismatch — agent skills may not satisfy routing requirements";
    if (/capacity/i.test(message))
      return "Capacity issue — agent may have been near their limit";
    return message.length > 60 ? message.slice(0, 57) + "…" : message;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}

      <button
        onClick={() => router.push("/work-items")}
        className="text-sm text-brand-500 hover:underline mb-4 block dark:text-brand-400"
      >
        ← Back to work items
      </button>

      {/* Header: work item name + pill strip */}
      <div className="mb-6">
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
          {allWarnings.length > 0 && (
            <div className="relative group">
              <button className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors text-xs font-bold">
                ⚠
              </button>
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

      {/* Route Map — the main view */}
      <div className="mb-6">
        <RouteMap chain={chain} />
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
      <div className="mb-6">
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
    </div>
  );
}

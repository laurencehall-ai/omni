"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RoutingTrace, RoutingExplanation, CorrectionInput, ConfigSuggestion } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/utils";
import { markValidated } from "@/lib/validations";
import CorrectionPanel from "@/components/CorrectionPanel";
import SuggestionPanel from "@/components/SuggestionPanel";
import DataPanel from "@/components/DataPanel";
import SubwayMap from "@/components/SubwayMap";
import Confetti from "@/components/Confetti";

interface TraceResult {
  trace: RoutingTrace;
  explanation: RoutingExplanation;
  narration: string;
}

type Verdict = "correct" | "incorrect" | null;

function buildExecSummary(trace: RoutingTrace, explanation: RoutingExplanation): string[] {
  const bullets: string[] = [];
  bullets.push(`Routed via **${trace.routingModel}** model through **${trace.channelLabel}** → **${trace.queueName}**`);
  bullets.push(`Assigned to **${trace.agentName}**${trace.timeToAcceptSeconds != null ? ` — accepted in **${formatDuration(trace.timeToAcceptSeconds)}**` : ""}`);
  if (trace.requiredSkills.length > 0) {
    bullets.push(`Skills-based match: **${trace.requiredSkills.map(s => s.skillName).join(", ")}**`);
  } else {
    bullets.push(`No skill requirements — any available agent in queue was eligible`);
  }
  if (explanation.flags.some(f => f.type === "warning")) {
    bullets.push(`⚠ ${explanation.flags.find(f => f.type === "warning")!.message}`);
  }
  return bullets;
}

function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-slate-900 dark:text-white">{p}</strong>
      : <span key={i}>{p}</span>
  );
}

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
        if (r.status === 401) { router.push("/connect"); return null; }
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

  const handleCorrection = useCallback(async (correction: CorrectionInput) => {
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
      setSuggestError(e instanceof Error ? e.message : "Failed to generate suggestion");
    } finally {
      setSuggestLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-mono">Tracing routing decision…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-16">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400 mb-4">{error}</div>
        <button onClick={() => router.back()} className="text-sm text-brand-500 hover:underline">← Back to work items</button>
      </div>
    );
  }

  if (!result) return null;

  const { trace, explanation, narration } = result;
  const execSummary = buildExecSummary(trace, explanation);

  return (
    <div className="max-w-5xl mx-auto">
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}

      <button onClick={() => router.push("/work-items")}
        className="text-sm text-brand-500 hover:underline mb-6 block dark:text-brand-400">
        ← Back to work items
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">{trace.channelLabel}</span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">{trace.routingModel}</span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{formatDate(trace.createdDate)}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          {trace.workItemType} <span className="text-brand-500 dark:text-brand-400">→</span> {trace.queueName}
        </h1>
        {trace.timeToAcceptSeconds != null && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
            Accepted in {formatDuration(trace.timeToAcceptSeconds)}
          </p>
        )}
      </div>

      {/* Warning flags */}
      {explanation.flags.some(f => f.type === "warning") && (
        <div className="space-y-2 mb-6">
          {explanation.flags.filter(f => f.type === "warning").map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-sm px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <span>⚠</span><span>{f.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main 2-col layout: exec summary + subway map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Left: exec summary + narration */}
        <div className="space-y-4">
          {/* Executive summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-brand-500 rounded-full" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">Why It Routed This Way</h2>
            </div>
            <ul className="space-y-2">
              {execSummary.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="text-brand-500 dark:text-brand-400 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                  <span>{renderBold(line)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Full narration — collapsed by default */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => setShowFullNarration(!showFullNarration)}
              className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Full Explanation</span>
              <span className="text-slate-400">{showFullNarration ? "▲" : "▼"}</span>
            </button>
            {showFullNarration && (
              <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-800">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pt-4">{narration}</p>
              </div>
            )}
          </div>

          {/* Raw data toggle */}
          <button onClick={() => setShowRawData(!showRawData)}
            className="text-xs text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 font-mono">
            {showRawData ? "▲ Hide" : "▼ Show"} raw routing data
          </button>
          {showRawData && <DataPanel trace={trace} explanation={explanation} />}
        </div>

        {/* Right: subway map */}
        <div>
          <SubwayMap trace={trace} />
        </div>
      </div>

      {/* Verdict */}
      {verdict === null && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Did this route correctly?</p>
          <div className="flex gap-3">
            <button onClick={() => { setVerdict("correct"); setShowConfetti(true); markValidated(id); }}
              className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-400 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              <span>👍</span> Yes, routed correctly
            </button>
            <button onClick={() => setVerdict("incorrect")}
              className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              <span>👎</span> No, this was wrong
            </button>
          </div>
        </div>
      )}

      {verdict === "correct" && !showConfetti && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center animate-fade-in">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-green-800 dark:text-green-400 font-bold text-lg">Routing confirmed correct!</p>
          <p className="text-sm text-green-600 dark:text-green-500 mt-1">This route is validated and can serve as a baseline for testing your configuration.</p>
        </div>
      )}

      {verdict === "incorrect" && !suggestion && (
        <CorrectionPanel onSubmit={handleCorrection} loading={suggestLoading} error={suggestError} />
      )}

      {suggestion && <SuggestionPanel suggestion={suggestion} />}
    </div>
  );
}

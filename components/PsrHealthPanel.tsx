"use client";

import { useState, useEffect, useCallback } from "react";
import type { PsrRecord } from "@/app/api/health/route";

// Age thresholds for traffic-light severity
const AMBER_MINUTES = 5;
const RED_MINUTES = 30;

function ageSeverity(minutes: number): "green" | "amber" | "red" {
  if (minutes >= RED_MINUTES) return "red";
  if (minutes >= AMBER_MINUTES) return "amber";
  return "green";
}

function formatAge(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function SeverityDot({ severity }: { severity: "green" | "amber" | "red" }) {
  const cls =
    severity === "red"
      ? "bg-red-500"
      : severity === "amber"
        ? "bg-amber-400"
        : "bg-emerald-400";
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cls}`} />;
}

function PsrRow({ psr }: { psr: PsrRecord }) {
  const severity = ageSeverity(psr.ageMinutes);
  const rowBg =
    severity === "red"
      ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
      : severity === "amber"
        ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700";

  return (
    <div className={`border rounded-lg px-4 py-3 flex items-center gap-4 text-xs font-mono ${rowBg}`}>
      <SeverityDot severity={severity} />

      {/* Age */}
      <span
        className={`font-bold w-14 shrink-0 ${
          severity === "red"
            ? "text-red-600 dark:text-red-400"
            : severity === "amber"
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
        }`}
      >
        {formatAge(psr.ageMinutes)}
      </span>

      {/* Work item type + short ID */}
      <span className="text-slate-700 dark:text-slate-300 w-28 shrink-0 truncate">
        {psr.workItemType}
        <span className="text-slate-400 dark:text-slate-500 ml-1">
          ···{psr.workItemId.slice(-6)}
        </span>
      </span>

      {/* Queue */}
      <span className="text-slate-600 dark:text-slate-400 flex-1 truncate">
        {psr.queueName ?? "—"}
      </span>

      {/* Flags */}
      <div className="flex items-center gap-2 shrink-0">
        {!psr.isReadyForRouting && (
          <span className="text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-[10px]">
            Not Ready
          </span>
        )}
        {psr.isPushed && (
          <span className="text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded text-[10px]">
            Pushed
          </span>
        )}
        {psr.capacityWeight != null && (
          <span className="text-slate-400 dark:text-slate-500 text-[10px]">
            cap {psr.capacityWeight}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PsrHealthPanel() {
  const [psrs, setPsrs] = useState<PsrRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      setPsrs(data.psrs);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount, auto-refresh every 30 seconds
  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const redCount = psrs?.filter((p) => ageSeverity(p.ageMinutes) === "red").length ?? 0;
  const amberCount = psrs?.filter((p) => ageSeverity(p.ageMinutes) === "amber").length ?? 0;
  const total = psrs?.length ?? 0;

  const headerSeverity =
    redCount > 0 ? "red" : amberCount > 0 ? "amber" : "green";

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {!loading && psrs !== null && (
              <SeverityDot severity={headerSeverity} />
            )}
            {loading && (
              <div className="w-2 h-2 rounded-full border border-slate-300 dark:border-slate-600 animate-pulse" />
            )}
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
              Pending Service Routing
            </h2>
          </div>
          {!loading && psrs !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                {total} open
              </span>
              {redCount > 0 && (
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  {redCount} &gt;30m
                </span>
              )}
              {amberCount > 0 && (
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  {amberCount} &gt;5m
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">
              {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="text-[10px] font-mono px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-40 transition-colors"
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {loading && psrs === null && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
              Querying PendingServiceRouting…
            </span>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {!loading && !error && psrs !== null && psrs.length === 0 && (
          <div className="flex items-center gap-3 py-4 justify-center">
            <span className="text-emerald-500">✓</span>
            <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">
              No pending routing records — all work items are dispatched
            </span>
          </div>
        )}

        {psrs !== null && psrs.length > 0 && (
          <>
            {/* Column headers */}
            <div className="flex items-center gap-4 px-4 pb-1.5 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-600 font-mono">
              <span className="w-2 shrink-0" />
              <span className="w-14 shrink-0">Age</span>
              <span className="w-28 shrink-0">Work Item</span>
              <span className="flex-1">Queue</span>
              <span className="shrink-0">Flags</span>
            </div>
            <div className="space-y-1.5">
              {psrs.map((psr) => (
                <PsrRow key={psr.id} psr={psr} />
              ))}
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-600 font-mono mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              Auto-refreshes every 30s · Amber ≥ {AMBER_MINUTES}m · Red ≥ {RED_MINUTES}m · PendingServiceRouting records exist until dispatched to an agent
            </p>
          </>
        )}
      </div>
    </div>
  );
}

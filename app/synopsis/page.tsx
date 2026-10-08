"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { SynopsisData } from "@/lib/sf-synopsis";
import type { TopologyGraph } from "@/lib/topology-types";
import PsrHealthPanel from "@/components/PsrHealthPanel";

const TopologyMap = dynamic(() => import("@/components/TopologyMap"), { ssr: false });

interface SynopsisResponse {
  synopsis: SynopsisData;
  narration: string;
}

interface StatCardProps {
  label: string;
  value: number | null;
  color: string;
  tooltip: string;
}

function StatCard({ label, value, color, tooltip }: StatCardProps) {
  const [showing, setShowing] = useState(false);
  return (
    <div
      className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 flex flex-col gap-1 cursor-default"
      onMouseEnter={() => setShowing(true)}
      onMouseLeave={() => setShowing(false)}
    >
      <span
        className="text-3xl font-black"
        style={{ color: value !== null ? color : undefined }}
      >
        {value !== null ? (
          value
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        )}
      </span>
      <div className="flex items-center gap-1">
        <span className="text-slate-500 dark:text-slate-400 text-xs font-mono uppercase tracking-widest">
          {label}
        </span>
        <span className="text-slate-300 dark:text-slate-600 text-xs">ⓘ</span>
      </div>
      {value === null && (
        <span className="text-slate-400 dark:text-slate-600 text-[10px] font-mono">
          not available via API
        </span>
      )}
      {showing && (
        <div className="absolute bottom-full left-0 mb-2 z-10 w-64 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
          <p className="text-[11px] text-slate-300 leading-relaxed font-mono">
            {tooltip}
          </p>
          {value === null && (
            <p className="text-[10px] text-amber-400 mt-1 font-mono">
              This object requires Metadata API access and cannot be queried
              here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function RouteMapPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SynopsisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [topoLoading, setTopoLoading] = useState(false);
  const [topoData, setTopoData] = useState<TopologyGraph | null>(null);
  const [topoError, setTopoError] = useState<string | null>(null);

  async function loadSynopsis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/synopsis");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount
  useEffect(() => {
    loadSynopsis();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateTopology() {
    setTopoLoading(true);
    setTopoError(null);
    try {
      const res = await fetch("/api/topology");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setTopoData(await res.json());
    } catch (err) {
      setTopoError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTopoLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            RouteMap
          </h1>
          <span className="text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 px-2 py-0.5 rounded font-mono uppercase tracking-wide">
            beta
          </span>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-mono">
          Org-wide Omni-Channel configuration overview
        </p>
      </div>

      {/* PSR health check — always visible, auto-refreshes every 30s */}
      <PsrHealthPanel />

      {/* Stat tiles + routing narrative — auto-load on mount */}
      <div className="space-y-6">
        {loading && !data && (
          <div className="flex items-center gap-3 py-10 justify-center">
            <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400 dark:text-slate-500 font-mono">
              Loading routing configuration…
            </span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-5 py-4 text-sm font-mono flex items-start justify-between gap-4">
            <span>{error}</span>
            <button
              onClick={loadSynopsis}
              className="shrink-0 text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
            >
              Retry
            </button>
          </div>
        )}

        {data && (
          <>
            <div className="flex justify-end">
              <button
                onClick={loadSynopsis}
                disabled={loading}
                className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-60 text-slate-700 dark:text-white text-xs font-mono px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard
                label="Channels"
                value={data.synopsis.channels.length}
                color="#38bdf8"
                tooltip="Setup → Omni-Channel → Service Channels. Each channel maps a Salesforce object type (Case, Voice Call, etc.) to Omni-Channel."
              />
              <StatCard
                label="Queues"
                value={
                  data.synopsis.queues !== null
                    ? data.synopsis.queues.length
                    : null
                }
                color="#c084fc"
                tooltip="Setup → Queues. Omni-Channel queues receive work items and hold them until an agent is available. Only queues linked to a Routing Configuration appear here."
              />
              <StatCard
                label="Skills"
                value={data.synopsis.skills.length}
                color="#34d399"
                tooltip="Setup → Omni-Channel → Skills. Skills are assigned to agents and required by routing configs to enable skills-based routing."
              />
              <StatCard
                label="Active Users"
                value={data.synopsis.agentCount}
                color="#94a3b8"
                tooltip="All active standard Salesforce users in the org. Not all may be Omni-Channel agents — check Presence Configurations (Setup → Omni-Channel → Presence Configurations) to see who is configured."
              />
            </div>

            {/* Routing narrative */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-6 py-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-black">AI</span>
                </div>
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Routing Narrative
                </h2>
              </div>
              <div className="space-y-3">
                {data.narration.split("\n\n").map((para, i) => (
                  <p
                    key={i}
                    className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-slate-400 dark:text-slate-600 font-mono border-t border-slate-200 dark:border-slate-800 pt-4">
              RouteMap is generated from routing configuration metadata only. No
              customer data is included.
            </p>
          </>
        )}
      </div>

      {/* Topology map */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-brand-500 rounded-full" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
              Org Topology
            </h2>
            <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 px-1.5 py-0.5 rounded font-mono uppercase tracking-wide">
              beta
            </span>
          </div>
          {!topoData && (
            <button
              onClick={generateTopology}
              disabled={topoLoading}
              className="text-xs font-mono px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold transition-colors"
            >
              {topoLoading ? "Building…" : "Generate Topology"}
            </button>
          )}
          {topoData && (
            <button
              onClick={generateTopology}
              disabled={topoLoading}
              className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-40 transition-colors"
            >
              {topoLoading ? "Refreshing…" : "Refresh"}
            </button>
          )}
        </div>

        <div className="p-5">
          {!topoData && !topoLoading && !topoError && (
            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono text-center py-6">
              Maps all routing connections across your org — channels, configs,
              agents, skills, flows, queues, and objects.
            </p>
          )}
          {topoLoading && (
            <div className="flex items-center gap-2 py-8 justify-center">
              <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                Querying org topology…
              </span>
            </div>
          )}
          {topoError && (
            <div className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              {topoError}
            </div>
          )}
          {topoData && <TopologyMap graph={topoData} />}
        </div>
      </div>
    </div>
  );
}

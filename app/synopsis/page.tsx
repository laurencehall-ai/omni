"use client";

import { useState } from "react";
import { useTheme } from "@/lib/use-theme";
import type { SynopsisData } from "@/lib/sf-synopsis";

interface SynopsisResponse {
  synopsis: SynopsisData;
  narration: string;
}

interface StatCardProps {
  label: string;
  value: number | null; // null = unavailable (object not queryable in this org)
  color: string;
  tooltip: string; // where to find this in Setup
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

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function OrgSubwayMap({ synopsis }: { synopsis: SynopsisData }) {
  const isDark = useTheme();
  const { channels } = synopsis;

  const CHANNEL_X = 160;
  const NODE_SPACING = 72;
  const TOP_PADDING = 50;

  const svgHeight = Math.max(
    channels.length * NODE_SPACING + TOP_PADDING + 40,
    200,
  );
  const svgWidth = 320;

  function yFor(index: number): number {
    const colHeight = (channels.length - 1) * NODE_SPACING;
    const startY = TOP_PADDING + (svgHeight - TOP_PADDING - 40 - colHeight) / 2;
    return startY + index * NODE_SPACING;
  }

  return (
    <div
      className={`${isDark ? "bg-slate-900" : "bg-slate-100"} rounded-xl border ${isDark ? "border-slate-700" : "border-slate-300"} overflow-hidden`}
    >
      <div
        className={`${isDark ? "bg-slate-800" : "bg-slate-200"} px-4 py-2 flex items-center justify-between border-b ${isDark ? "border-slate-700" : "border-slate-300"}`}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-brand-500 flex items-center justify-center">
            <span className="text-white text-[9px] font-black">RC</span>
          </div>
          <span
            className={`${isDark ? "text-white" : "text-slate-800"} text-xs font-bold tracking-widest uppercase`}
          >
            Org-Wide Routing Map
          </span>
          <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono uppercase tracking-wide">
            beta
          </span>
        </div>
        <span
          className={`${isDark ? "text-slate-400" : "text-slate-500"} text-xs font-mono`}
        >
          {channels.length} channel{channels.length !== 1 ? "s" : ""}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full max-w-sm mx-auto"
        style={{ height: svgHeight, display: "block" }}
      >
        {Array.from({ length: Math.ceil(svgHeight / 40) }, (_, i) => (
          <line
            key={i}
            x1={0}
            y1={i * 40}
            x2={svgWidth}
            y2={i * 40}
            stroke={isDark ? "#1e293b" : "#e2e8f0"}
            strokeWidth={1}
          />
        ))}

        <text
          x={CHANNEL_X}
          y={22}
          textAnchor="middle"
          fill="#38bdf8"
          fontSize={8}
          fontFamily="monospace"
          fontWeight="700"
          style={{ letterSpacing: "0.1em" }}
        >
          CHANNELS
        </text>

        {channels.map((ch, i) => (
          <g key={ch.id} transform={`translate(${CHANNEL_X},${yFor(i)})`}>
            <circle r={22} fill="#0070d2" stroke="#004f94" strokeWidth={2} />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={9}
              fontFamily="monospace"
              fontWeight="bold"
            >
              CH
            </text>
            <text
              textAnchor="middle"
              y={34}
              fill={isDark ? "white" : "#1e293b"}
              fontSize={8}
              fontFamily="monospace"
              fontWeight="600"
            >
              {truncate(ch.label, 16)}
            </text>
          </g>
        ))}

        {channels.length === 0 && (
          <text
            x={CHANNEL_X}
            y={svgHeight / 2}
            textAnchor="middle"
            fill="#475569"
            fontSize={9}
            fontFamily="monospace"
          >
            none
          </text>
        )}
      </svg>

      <div
        className={`${isDark ? "bg-slate-800/50" : "bg-slate-50"} px-4 py-2 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}
      >
        <p
          className={`${isDark ? "text-slate-500" : "text-slate-400"} text-[10px] font-mono`}
        >
          More connections coming as data sources expand
        </p>
      </div>
    </div>
  );
}

export default function RouteMapPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SynopsisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
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

      {!data && (
        <div className="flex flex-col items-center gap-4 py-12">
          <button
            onClick={generate}
            disabled={loading}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-all text-sm tracking-wide uppercase"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                Generating…
              </span>
            ) : (
              "Generate RouteMap"
            )}
          </button>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-mono text-center max-w-sm">
            Queries your org&apos;s routing configuration metadata. No customer
            data is accessed.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-5 py-4 text-sm font-mono">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="flex justify-end">
            <button
              onClick={generate}
              disabled={loading}
              className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-60 text-slate-700 dark:text-white text-xs font-mono px-4 py-2 rounded-lg transition-colors"
            >
              {loading ? "Regenerating…" : "Regenerate"}
            </button>
          </div>

          {/* Stat cards — hover each for Setup path */}
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

          <OrgSubwayMap synopsis={data.synopsis} />

          <p className="text-center text-xs text-slate-400 dark:text-slate-600 font-mono border-t border-slate-200 dark:border-slate-800 pt-4">
            RouteMap is generated from routing configuration metadata only. No
            customer data is included.
          </p>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { SynopsisData } from "@/lib/sf-synopsis";

interface SynopsisResponse {
  synopsis: SynopsisData;
  narration: string;
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="text-3xl font-black" style={{ color }}>{value}</span>
      <span className="text-slate-400 text-xs font-mono uppercase tracking-widest">{label}</span>
    </div>
  );
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

interface OrgSubwayMapProps {
  synopsis: SynopsisData;
}

function OrgSubwayMap({ synopsis }: OrgSubwayMapProps) {
  const { channels, queues, routingConfigs } = synopsis;

  const CHANNEL_X = 80;
  const QUEUE_X = 280;
  const CONFIG_X = 480;
  const NODE_SPACING = 80;
  const TOP_PADDING = 50;

  const maxRows = Math.max(channels.length, queues.length, routingConfigs.length, 1);
  const svgHeight = Math.max(maxRows * NODE_SPACING + TOP_PADDING + 30, 200);
  const svgWidth = 580;

  function yFor(index: number, count: number, total: number): number {
    // Centre the column vertically within the total height
    const colHeight = (count - 1) * NODE_SPACING;
    const startY = TOP_PADDING + ((total - 1) * NODE_SPACING - colHeight) / 2;
    return startY + index * NODE_SPACING;
  }

  const channelYs = channels.map((_, i) => yFor(i, channels.length, maxRows));
  const queueYs = queues.map((_, i) => yFor(i, queues.length, maxRows));
  const configYs = routingConfigs.map((_, i) => yFor(i, routingConfigs.length, maxRows));

  // Lines: every channel to every queue, every queue to every routing config
  const channelToQueue: Array<[number, number]> = [];
  channels.forEach((_, ci) =>
    queues.forEach((_, qi) => channelToQueue.push([ci, qi]))
  );

  const queueToConfig: Array<[number, number]> = [];
  queues.forEach((_, qi) =>
    routingConfigs.forEach((_, ri) => queueToConfig.push([qi, ri]))
  );

  // Limit lines to avoid a wall of spaghetti on large orgs
  const MAX_LINES = 60;
  const shownCQ = channelToQueue.slice(0, MAX_LINES);
  const shownQR = queueToConfig.slice(0, MAX_LINES);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-brand-500 flex items-center justify-center">
            <span className="text-white text-[9px] font-black">RC</span>
          </div>
          <span className="text-white text-xs font-bold tracking-widest uppercase">Org-Wide Routing Map</span>
        </div>
        <span className="text-slate-400 text-xs font-mono">
          {channels.length}ch · {queues.length}q · {routingConfigs.length}cfg
        </span>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ height: svgHeight, display: "block" }}
      >
        {/* Subtle horizontal grid lines */}
        {Array.from({ length: Math.ceil(svgHeight / 40) }, (_, i) => (
          <line
            key={i}
            x1={0} y1={i * 40} x2={svgWidth} y2={i * 40}
            stroke="#1e293b" strokeWidth={1}
          />
        ))}

        {/* Channel → Queue lines */}
        {shownCQ.map(([ci, qi], i) => (
          <line
            key={`cq-${i}`}
            x1={CHANNEL_X} y1={channelYs[ci]}
            x2={QUEUE_X} y2={queueYs[qi]}
            stroke="#38bdf840" strokeWidth={1.5}
          />
        ))}

        {/* Queue → RoutingConfig lines */}
        {shownQR.map(([qi, ri], i) => (
          <line
            key={`qr-${i}`}
            x1={QUEUE_X} y1={queueYs[qi]}
            x2={CONFIG_X} y2={configYs[ri]}
            stroke="#c084fc40" strokeWidth={1.5}
          />
        ))}

        {/* Column headers */}
        {[
          { x: CHANNEL_X, label: "CHANNELS", color: "#38bdf8" },
          { x: QUEUE_X, label: "QUEUES", color: "#c084fc" },
          { x: CONFIG_X, label: "ROUTING CONFIGS", color: "#f472b6" },
        ].map(({ x, label, color }) => (
          <text
            key={label}
            x={x}
            y={18}
            textAnchor="middle"
            fill={color}
            fontSize={8}
            fontFamily="monospace"
            fontWeight="700"
            style={{ letterSpacing: "0.1em" }}
          >
            {label}
          </text>
        ))}

        {/* Channel nodes */}
        {channels.map((ch, i) => (
          <g key={ch.id} transform={`translate(${CHANNEL_X},${channelYs[i]})`}>
            <circle r={20} fill="#0070d2" stroke="#004f94" strokeWidth={2} />
            <text textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={9} fontFamily="monospace" fontWeight="bold">
              CH
            </text>
            <text textAnchor="middle" y={32} fill="white" fontSize={8}
              fontFamily="monospace" fontWeight="600">
              {truncate(ch.label, 12)}
            </text>
            {ch.routingModel && (
              <text textAnchor="middle" y={43} fill="#94a3b8" fontSize={7}
                fontFamily="monospace">
                {truncate(ch.routingModel, 12)}
              </text>
            )}
          </g>
        ))}

        {channels.length === 0 && (
          <text x={CHANNEL_X} y={svgHeight / 2} textAnchor="middle"
            fill="#475569" fontSize={9} fontFamily="monospace">none</text>
        )}

        {/* Queue nodes */}
        {queues.map((q, i) => (
          <g key={q.id} transform={`translate(${QUEUE_X},${queueYs[i]})`}>
            <circle r={20} fill="#7209b7" stroke="#560bad" strokeWidth={2} />
            <text textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={9} fontFamily="monospace" fontWeight="bold">
              Q
            </text>
            <text textAnchor="middle" y={32} fill="white" fontSize={8}
              fontFamily="monospace" fontWeight="600">
              {truncate(q.name, 12)}
            </text>
          </g>
        ))}

        {queues.length === 0 && (
          <text x={QUEUE_X} y={svgHeight / 2} textAnchor="middle"
            fill="#475569" fontSize={9} fontFamily="monospace">none</text>
        )}

        {/* RoutingConfig nodes */}
        {routingConfigs.map((rc, i) => (
          <g key={rc.id} transform={`translate(${CONFIG_X},${configYs[i]})`}>
            <circle r={20} fill="#f72585" stroke="#b5179e" strokeWidth={2} />
            <text textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={9} fontFamily="monospace" fontWeight="bold">
              M
            </text>
            <text textAnchor="middle" y={32} fill="white" fontSize={8}
              fontFamily="monospace" fontWeight="600">
              {truncate(rc.name, 12)}
            </text>
            <text textAnchor="middle" y={43} fill="#94a3b8" fontSize={7}
              fontFamily="monospace">
              {truncate(rc.routingModel, 12)}
            </text>
          </g>
        ))}

        {routingConfigs.length === 0 && (
          <text x={CONFIG_X} y={svgHeight / 2} textAnchor="middle"
            fill="#475569" fontSize={9} fontFamily="monospace">none</text>
        )}
      </svg>

      {/* Legend */}
      <div className="bg-slate-800/50 px-4 py-2 flex flex-wrap gap-3 border-t border-slate-700">
        {[
          { fill: "#0070d2", stroke: "#004f94", label: "channel" },
          { fill: "#7209b7", stroke: "#560bad", label: "queue" },
          { fill: "#f72585", stroke: "#b5179e", label: "routing config" },
        ].map(({ fill, stroke, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border" style={{ background: fill, borderColor: stroke }} />
            <span className="text-slate-400 text-[10px] font-mono capitalize">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SynopsisPage() {
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
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Routing Synopsis
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-mono">
          Org-wide Omni-Channel configuration overview
        </p>
      </div>

      {/* Generate button */}
      {!data && (
        <div className="flex flex-col items-center gap-4 py-12">
          <button
            onClick={generate}
            disabled={loading}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-all text-sm tracking-wide uppercase"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generating…
              </span>
            ) : "Generate Routing Synopsis"}
          </button>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-mono text-center max-w-sm">
            Queries your org&apos;s routing configuration metadata and generates an AI-powered narrative. No customer data is accessed.
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
          {/* Regenerate button */}
          <div className="flex justify-end">
            <button
              onClick={generate}
              disabled={loading}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white text-xs font-mono px-4 py-2 rounded-lg transition-colors"
            >
              {loading ? "Regenerating…" : "Regenerate"}
            </button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Channels" value={data.synopsis.channels.length} color="#38bdf8" />
            <StatCard label="Queues" value={data.synopsis.queues.length} color="#c084fc" />
            <StatCard label="Routing Configs" value={data.synopsis.routingConfigs.length} color="#f472b6" />
            <StatCard label="Skills" value={data.synopsis.skills.length} color="#34d399" />
            <StatCard label="Presence Configs" value={data.synopsis.presenceConfigs.length} color="#fbbf24" />
            <StatCard label="Active Agents" value={data.synopsis.agentCount} color="#94a3b8" />
          </div>

          {/* Narration card */}
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
                <p key={i} className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          </div>

          {/* Subway map */}
          <OrgSubwayMap synopsis={data.synopsis} />

          {/* Privacy note */}
          <p className="text-center text-xs text-slate-400 dark:text-slate-600 font-mono border-t border-slate-200 dark:border-slate-800 pt-4">
            This synopsis is generated from your org&apos;s routing configuration metadata only. No customer data is included.
          </p>
        </>
      )}
    </div>
  );
}

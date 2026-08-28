"use client";

// ─── SubwayMap ────────────────────────────────────────────────────────────────
// SVG routing diagram styled after a subway/metro map.
// Shows the path a work item took: Channel → Queue → [Skills] → Routing Model → Agent.
// Clicking a station circle shows a detail panel at the bottom of the map.
//
// Why JS-driven colors instead of Tailwind dark: classes?
// SVG fill and stroke attributes can't use CSS classes — they need inline values.
// We use useTheme() to get a reactive isDark boolean and switch colors in JS.

import { useState } from "react";
import { RoutingTrace } from "@/lib/types";
import { useTheme } from "@/lib/use-theme";

// A node (station) in the routing diagram
interface Node {
  id: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  type: "channel" | "queue" | "model" | "agent" | "skill";
  active: boolean;
}

// A directed edge (line) between two nodes
interface Edge {
  from: string;
  to: string;
  active: boolean;
  label?: string; // Optional label drawn along the edge (e.g. "requires")
}

// Light fill color, stroke border, and dark-mode fill for each node type
const NODE_COLORS: Record<Node["type"], { fill: string; stroke: string; dark: string }> = {
  channel:  { fill: "#0070d2", stroke: "#004f94", dark: "#38bdf8" },
  queue:    { fill: "#7209b7", stroke: "#560bad", dark: "#c084fc" },
  model:    { fill: "#f72585", stroke: "#b5179e", dark: "#f472b6" },
  skill:    { fill: "#06d6a0", stroke: "#059669", dark: "#34d399" },
  agent:    { fill: "#ffd60a", stroke: "#d97706", dark: "#fbbf24" },
};

// Maps Salesforce RoutingModel API values to display labels for the header
const ROUTING_TYPE_LABEL: Record<string, string> = {
  QueueBased:       "Queue-Based",
  SkillsBased:      "Skills-Based",
  ExternalRouting:  "External",
  OmniFlow:         "Omni Flow",
  Queue:            "Queue-Based",
};

function routingTypeLabel(rt: string) {
  return ROUTING_TYPE_LABEL[rt] ?? rt;
}

// ─── buildGraph ───────────────────────────────────────────────────────────────
// Constructs the list of nodes and edges for a routing trace.
// When skills are required, skill nodes fan out between Queue and Model.
// Without skills, the layout is a straight vertical chain.
function buildGraph(trace: RoutingTrace): { nodes: Node[]; edges: Edge[] } {
  const hasSkills = trace.agentSkills.length > 0 || trace.requiredSkills.length > 0;
  const isSkillsBased = trace.routingModel === "SkillsBased" || hasSkills;

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const W = 560;
  const cx = W / 2; // Horizontal center of the SVG

  // Top: Channel station
  nodes.push({
    id: "channel", label: trace.channelLabel ?? "Channel", sublabel: "Channel",
    x: cx, y: 50, type: "channel", active: true,
  });

  // Queue station
  nodes.push({
    id: "queue", label: trace.queueName ?? "Queue", sublabel: "Queue",
    x: cx, y: 160, type: "queue", active: true,
  });
  edges.push({ from: "channel", to: "queue", active: true });

  if (isSkillsBased && trace.requiredSkills.length > 0) {
    // Fan out up to 3 skill nodes horizontally between Queue and Model
    const skills = trace.requiredSkills.slice(0, 3);
    const startX = cx - (skills.length - 1) * 90;
    skills.forEach((s, i) => {
      const sid = `skill-${i}`;
      nodes.push({
        id: sid, label: s.skillName ?? "Skill", sublabel: `L${s.skillLevel ?? "?"}`,
        x: startX + i * 90, y: 270, type: "skill", active: true,
      });
      edges.push({ from: "queue", to: sid, active: true, label: "requires" });
      edges.push({ from: sid, to: "model", active: true });
    });
    // Model sits below the skill nodes
    nodes.push({
      id: "model", label: trace.routingModel ?? "Model", sublabel: "Routing Model",
      x: cx, y: 380, type: "model", active: true,
    });
  } else {
    // No skills — direct vertical chain
    nodes.push({
      id: "model", label: trace.routingModel ?? "Model", sublabel: "Routing Model",
      x: cx, y: 270, type: "model", active: true,
    });
    edges.push({ from: "queue", to: "model", active: true });
  }

  // Bottom: Agent station
  nodes.push({
    id: "agent", label: trace.agentName ?? "Unassigned", sublabel: "Assigned Agent",
    x: cx, y: isSkillsBased && trace.requiredSkills.length > 0 ? 490 : 380,
    type: "agent", active: true,
  });
  edges.push({ from: "model", to: "agent", active: true });

  return { nodes, edges };
}

// Returns the SVG height needed to fit all nodes with padding at the bottom
function getNodeY(nodes: Node[]): number {
  return Math.max(...nodes.map(n => n.y)) + 70;
}

// ─── SubwayMap component ──────────────────────────────────────────────────────

export default function SubwayMap({ trace }: { trace: RoutingTrace }) {
  const [selected, setSelected] = useState<string | null>(null);
  const isDark = useTheme(); // Reactive dark mode flag — fires when toggle switches <html> class
  const { nodes, edges } = buildGraph(trace);
  const svgHeight = getNodeY(nodes);
  const W = 560;

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const selectedNode = selected ? nodeMap.get(selected) : null;

  return (
    <div className={`${isDark ? "bg-slate-950" : "bg-slate-100"} rounded-xl overflow-hidden border ${isDark ? "border-slate-700" : "border-slate-300"}`}>

      {/* MTA-style header bar */}
      <div className={`${isDark ? "bg-slate-800" : "bg-slate-200"} px-4 py-2 flex items-center justify-between border-b ${isDark ? "border-slate-700" : "border-slate-300"}`}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-brand-500 flex items-center justify-center">
            <span className="text-white text-[9px] font-black">RC</span>
          </div>
          <span className={`${isDark ? "text-white" : "text-slate-800"} text-xs font-bold tracking-widest uppercase`}>Routing Map</span>
          <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono uppercase tracking-wide">beta</span>
        </div>
        <span className={`${isDark ? "text-slate-400" : "text-slate-500"} text-xs font-mono`}>{routingTypeLabel(trace.routingModel)}</span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${svgHeight}`}
          className="w-full"
          style={{ height: svgHeight }}
        >
          {/* Horizontal grid lines — purely decorative, MTA-style background */}
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1={0} y1={i * 80 + 40} x2={W} y2={i * 80 + 40}
              stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth={1} />
          ))}

          {/* Edges: solid + bright when active, dashed + muted when dimmed by selection */}
          {edges.map((e, i) => {
            const from = nodeMap.get(e.from);
            const to = nodeMap.get(e.to);
            if (!from || !to) return null;
            // Dim edges that don't connect to the selected node
            const active = e.active && (selected === null || selected === e.from || selected === e.to);
            const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
            return (
              <g key={i}>
                <line
                  x1={from.x} y1={from.y + 18} x2={to.x} y2={to.y - 18}
                  stroke={active ? "#0070d2" : (isDark ? "#334155" : "#cbd5e1")}
                  strokeWidth={active ? 3 : 1.5}
                  strokeDasharray={active ? "none" : "4 4"}
                />
                {e.label && (
                  <text x={mid.x + 8} y={mid.y} fill={isDark ? "#64748b" : "#94a3b8"} fontSize={9}
                    fontFamily="monospace">{e.label}</text>
                )}
              </g>
            );
          })}

          {/* Nodes (stations) — click to select, click again to deselect */}
          {nodes.map((node) => {
            const colors = NODE_COLORS[node.type];
            const isSelected = selected === node.id;
            const dimmed = selected !== null && !isSelected;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onClick={() => setSelected(isSelected ? null : node.id)}
                className="cursor-pointer"
                style={{ opacity: dimmed ? 0.35 : 1 }}
              >
                {/* Glow ring shown behind the circle when selected */}
                {isSelected && (
                  <circle r={28} fill="none" stroke={colors.dark} strokeWidth={2}
                    opacity={0.6} />
                )}
                {/* Station circle */}
                <circle r={20} fill={colors.fill} stroke={colors.stroke} strokeWidth={2} />
                {/* Two-letter type abbreviation inside the circle */}
                <text textAnchor="middle" dominantBaseline="middle"
                  fill="white" fontSize={10} fontFamily="monospace" fontWeight="bold">
                  {node.type === "channel" ? "CH" :
                   node.type === "queue" ? "Q" :
                   node.type === "model" ? "M" :
                   node.type === "skill" ? "SK" : "AG"}
                </text>
                {/* Station name below the circle, truncated if long */}
                <text textAnchor="middle" y={32} fill={isDark ? "white" : "#1e293b"} fontSize={9}
                  fontFamily="monospace" fontWeight="600"
                  style={{ letterSpacing: "0.04em" }}>
                  {node.label.length > 14 ? node.label.slice(0, 13) + "…" : node.label}
                </text>
                {node.sublabel && (
                  <text textAnchor="middle" y={43} fill={isDark ? "#94a3b8" : "#64748b"} fontSize={8}
                    fontFamily="monospace">
                    {node.sublabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Detail panel — slides in at the bottom when a station is selected */}
        {selectedNode && (
          <div className={`absolute bottom-0 left-0 right-0 ${isDark ? "bg-slate-800/95" : "bg-white/95"} backdrop-blur-sm border-t ${isDark ? "border-slate-600" : "border-slate-200"} px-4 py-3 animate-fade-in`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`${isDark ? "text-white" : "text-slate-800"} text-xs font-bold uppercase tracking-wider mb-0.5`}>
                  {selectedNode.sublabel}
                </p>
                <p className="text-brand-500 dark:text-brand-400 text-sm font-mono">{selectedNode.label}</p>
                {/* Extra context for specific node types */}
                {selectedNode.id === "model" && (
                  <p className={`${isDark ? "text-slate-400" : "text-slate-500"} text-xs mt-1`}>
                    {trace.routingModel === "LeastActive"
                      ? "Routes to agent with fewest open items"
                      : trace.routingModel === "MostAvailable"
                      ? "Routes to agent with most remaining capacity"
                      : "External system determines routing target"}
                  </p>
                )}
                {selectedNode.id === "agent" && (
                  <p className={`${isDark ? "text-slate-400" : "text-slate-500"} text-xs mt-1`}>
                    {trace.agentUsername} · Accepted in {
                      trace.timeToAcceptSeconds != null
                        ? `${trace.timeToAcceptSeconds}s`
                        : "—"
                    }
                  </p>
                )}
                {selectedNode.id === "queue" && (
                  <p className={`${isDark ? "text-slate-400" : "text-slate-500"} text-xs mt-1`}>
                    Priority {trace.routingConfigPriority ?? "—"} ·{" "}
                    {trace.capacityWeight != null ? `Capacity weight ${trace.capacityWeight}` : "No capacity data"}
                  </p>
                )}
              </div>
              <button onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-white text-lg ml-4">×</button>
            </div>
          </div>
        )}
      </div>

      {/* Legend: one dot per node type */}
      <div className={`${isDark ? "bg-slate-800/50" : "bg-slate-50"} px-4 py-2 flex flex-wrap gap-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
        {(Object.entries(NODE_COLORS) as [Node["type"], typeof NODE_COLORS[Node["type"]]][]).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border" style={{ background: c.fill, borderColor: c.stroke }} />
            <span className={`${isDark ? "text-slate-400" : "text-slate-500"} text-[10px] font-mono capitalize`}>{type}</span>
          </div>
        ))}
        <span className={`${isDark ? "text-slate-500" : "text-slate-400"} text-[10px] font-mono ml-auto`}>tap a station for details</span>
      </div>
    </div>
  );
}

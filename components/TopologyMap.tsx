"use client";

import { useRef, useState, useLayoutEffect, useCallback } from "react";
import { TopologyGraph, TopologyNode, TopologyColumnId } from "@/lib/topology-types";

// ─── Column config ────────────────────────────────────────────────────────────

const COLUMNS: { id: TopologyColumnId; label: string; hex: string; tailwind: string }[] = [
  { id: "channel",       label: "Service Channels",    hex: "#0ea5e9", tailwind: "bg-sky-100 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300" },
  { id: "routingConfig", label: "Routing Configs",     hex: "#8b5cf6", tailwind: "bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-800 dark:text-violet-300" },
  { id: "agent",         label: "Agents",              hex: "#10b981", tailwind: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300" },
  { id: "skill",         label: "Skills",              hex: "#f59e0b", tailwind: "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300" },
  { id: "flow",          label: "Omni-Channel Flows",  hex: "#ec4899", tailwind: "bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700 text-pink-800 dark:text-pink-300" },
  { id: "queue",         label: "Queues",              hex: "#f97316", tailwind: "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-300" },
  { id: "object",        label: "Objects",             hex: "#94a3b8", tailwind: "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300" },
];

const COL_MAP = new Map(COLUMNS.map((c) => [c.id, c]));

const NODE_W = 140;
const NODE_H = 32;
const ROW_GAP = 10;
const COL_GAP = 80;

// ─── TopologyMap ──────────────────────────────────────────────────────────────

export default function TopologyMap({ graph }: { graph: TopologyGraph }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodeRects, setNodeRects] = useState<Map<string, DOMRect>>(new Map());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [svgDims, setSvgDims] = useState({ w: 0, h: 0 });

  // Group nodes by column, preserving COLUMNS order
  const byColumn = new Map<TopologyColumnId, TopologyNode[]>();
  for (const col of COLUMNS) byColumn.set(col.id, []);
  for (const node of graph.nodes) {
    byColumn.get(node.columnId)?.push(node);
  }

  // Measure node positions relative to the scrollable container.
  // getBoundingClientRect is viewport-relative and breaks when scrolled —
  // walk offsetLeft/offsetTop up to the container instead.
  const measureRects = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    function offsetRelativeTo(el: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
      let x = 0, y = 0;
      let cur: HTMLElement | null = el;
      while (cur && cur !== ancestor) {
        x += cur.offsetLeft;
        y += cur.offsetTop;
        cur = cur.offsetParent as HTMLElement | null;
      }
      return { x, y };
    }

    const local = new Map<string, DOMRect>();
    container.querySelectorAll<HTMLElement>("[data-node-id]").forEach((el) => {
      const id = el.getAttribute("data-node-id")!;
      const { x, y } = offsetRelativeTo(el, container);
      local.set(id, new DOMRect(x, y, el.offsetWidth, el.offsetHeight));
    });

    setNodeRects(local);
    setSvgDims({ w: container.scrollWidth, h: container.scrollHeight });
  }, []);

  useLayoutEffect(() => {
    measureRects();
    window.addEventListener("resize", measureRects);
    return () => window.removeEventListener("resize", measureRects);
  }, [measureRects, graph]);

  // Edge sets for hover highlighting
  const connectedToHovered = new Set<string>();
  if (hoveredId) {
    for (const e of graph.edges) {
      if (e.from === hoveredId || e.to === hoveredId) {
        connectedToHovered.add(e.from);
        connectedToHovered.add(e.to);
      }
    }
  }

  function edgeOpacity(edge: { from: string; to: string }): number {
    if (!hoveredId) return 0.35;
    if (edge.from === hoveredId || edge.to === hoveredId) return 0.85;
    return 0.06;
  }

  function nodeOpacity(nodeId: string): number {
    if (!hoveredId) return 1;
    if (nodeId === hoveredId || connectedToHovered.has(nodeId)) return 1;
    return 0.3;
  }

  // Build SVG bezier paths between node midpoints
  function edgePath(fromId: string, toId: string): string | null {
    const a = nodeRects.get(fromId);
    const b = nodeRects.get(toId);
    if (!a || !b) return null;
    const x1 = a.right;
    const y1 = a.top + a.height / 2;
    const x2 = b.left;
    const y2 = b.top + b.height / 2;
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }

  return (
    <div className="overflow-x-auto">
    <div
      ref={containerRef}
      className="relative"
      style={{ minHeight: 200, display: "inline-block", minWidth: "100%" }}
    >
      {/* SVG edge layer — absolutely positioned, sized to full scroll area so edges reach all columns */}
      {svgDims.w > 0 && (
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: svgDims.w, height: svgDims.h, pointerEvents: "none" }}
        >
          {graph.edges.map((e, i) => {
            const d = edgePath(e.from, e.to);
            if (!d) return null;
            const col = COL_MAP.get(e.fromColumn);
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={col?.hex ?? "#94a3b8"}
                strokeWidth={1.5}
                opacity={edgeOpacity(e)}
                style={{ transition: "opacity 0.15s" }}
              />
            );
          })}
        </svg>
      )}

      {/* Columns */}
      <div className="flex gap-0 relative" style={{ gap: COL_GAP }}>
        {COLUMNS.map((col) => {
          const colNodes = byColumn.get(col.id) ?? [];
          return (
            <div key={col.id} style={{ width: NODE_W, flexShrink: 0 }}>
              {/* Column header */}
              <div className="text-center mb-3">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest font-mono"
                  style={{ color: col.hex }}
                >
                  {col.label}
                </span>
              </div>

              {/* Nodes */}
              <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP }}>
                {colNodes.length === 0 ? (
                  <div
                    style={{ width: NODE_W, height: NODE_H }}
                    className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center"
                  >
                    <span className="text-[9px] text-slate-400 dark:text-slate-600 font-mono">not available</span>
                  </div>
                ) : (
                  colNodes.map((node) => (
                    <div
                      key={node.id}
                      data-node-id={node.id}
                      className={`border rounded-lg flex items-center px-2 cursor-default select-none transition-all ${col.tailwind}`}
                      style={{
                        width: NODE_W,
                        height: NODE_H,
                        opacity: nodeOpacity(node.id),
                        boxShadow: hoveredId === node.id ? `0 0 0 2px ${col.hex}` : undefined,
                      }}
                      onMouseEnter={() => setHoveredId(node.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <span className="text-[11px] font-mono font-medium truncate leading-tight w-full">
                        {node.label}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {graph.unavailableObjects.length > 0 && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          Could not query: {graph.unavailableObjects.join(", ")} — some connections may be incomplete
        </p>
      )}
    </div>
    </div>
  );
}

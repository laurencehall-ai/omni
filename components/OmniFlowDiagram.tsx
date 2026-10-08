"use client";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — CSS side-effect import, no type declarations needed
import "reactflow/dist/style.css";
import ReactFlow, {
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
} from "reactflow";
import { FlowGraphWithPath, FlowNode, FlowNodeKind } from "@/lib/flow-types";

// ─── Node layout ──────────────────────────────────────────────────────────────

const NODE_W = 168;
const NODE_H = 52;
const DIAMOND_W = 80;
const H_GAP = 48;
const V_GAP = 80;

function computeLayout(
  nodes: FlowNode[],
  edges: { from: string; to: string }[],
  startNodeName: string,
): Map<string, { x: number; y: number }> {
  // BFS to assign layers
  const layer = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }

  const queue: string[] = [startNodeName];
  layer.set(startNodeName, 0);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currLayer = layer.get(curr)!;
    for (const next of adj.get(curr) ?? []) {
      if (!layer.has(next)) {
        layer.set(next, currLayer + 1);
        queue.push(next);
      }
    }
  }

  // Assign any unvisited nodes to layer after max
  const layerValues = Array.from(layer.values());
  const maxLayer = Math.max(0, ...layerValues);
  const nodeNames = nodes.map((n) => n.name);
  for (const name of nodeNames) {
    if (!layer.has(name)) layer.set(name, maxLayer + 1);
  }

  // Group by layer
  const byLayer = new Map<number, string[]>();
  for (const [name, l] of Array.from(layer.entries())) {
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(name);
  }

  // Compute positions — center each layer horizontally
  const positions = new Map<string, { x: number; y: number }>();
  for (const [l, names] of Array.from(byLayer.entries())) {
    const totalW = names.length * NODE_W + (names.length - 1) * H_GAP;
    const startX = -totalW / 2;
    names.forEach((name: string, i: number) => {
      positions.set(name, {
        x: startX + i * (NODE_W + H_GAP),
        y: l * (NODE_H + V_GAP),
      });
    });
  }

  return positions;
}

// ─── Custom node components (defined outside to avoid ReactFlow warnings) ────

interface FlowNodeData {
  flowNode: FlowNode;
  onPath: boolean;
  isTerminal: boolean;
}

function nodeIcon(kind: FlowNodeKind, isTerminal: boolean): string {
  if (kind === "start") return "▶";
  if (kind === "checkAvailability") return "?";
  if (kind === "routeWork") return isTerminal ? "✓" : "→";
  if (kind === "playPrompt") return "▶";
  if (kind === "screenPop") return "⊡";
  if (kind === "decision") return "◆";
  return "·";
}

function ActionNode({ data }: { data: FlowNodeData }) {
  const { flowNode, onPath, isTerminal } = data;
  const icon = nodeIcon(flowNode.kind, isTerminal);

  let cls =
    "rounded-lg border flex items-center gap-1.5 px-3 text-xs font-medium transition-colors";
  if (onPath && isTerminal) {
    cls +=
      " bg-green-50 dark:bg-green-900/20 border-2 border-green-500 text-green-700 dark:text-green-400";
  } else if (onPath) {
    cls +=
      " bg-brand-50 dark:bg-brand-900/20 border-2 border-brand-500 text-brand-700 dark:text-brand-400";
  } else {
    cls +=
      " bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60";
  }

  return (
    <div style={{ width: NODE_W, height: NODE_H }} className={cls}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span className="shrink-0 text-[10px] opacity-70">{icon}</span>
      <span className="truncate leading-tight">{flowNode.label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

function StartNode({ data: _data }: { data: FlowNodeData }) {
  return (
    <div
      style={{ width: 120, height: NODE_H, borderRadius: 26 }}
      className="bg-brand-500 flex items-center justify-center text-white text-xs font-bold"
    >
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      ▶ Start
    </div>
  );
}

function DecisionNode({ data }: { data: FlowNodeData }) {
  const { flowNode, onPath } = data;
  const size = DIAMOND_W;
  let borderColor = onPath ? "#0070d2" : "#cbd5e1";

  return (
    <div
      style={{ width: size, height: size, position: "relative" }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: 0, left: "50%" }} />
      <div
        style={{
          width: size,
          height: size,
          transform: "rotate(45deg)",
          border: `2px solid ${borderColor}`,
          background: onPath ? "#eff6ff" : "#f8fafc",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 600,
          color: onPath ? "#0070d2" : "#94a3b8",
          padding: "0 8px",
          textAlign: "center",
          lineHeight: 1.2,
          wordBreak: "break-word",
        }}
      >
        {flowNode.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, bottom: 0, left: "50%" }} />
    </div>
  );
}

const nodeTypes = {
  actionNode: ActionNode,
  startNode: StartNode,
  decisionNode: DecisionNode,
};

// ─── OmniFlowDiagram ──────────────────────────────────────────────────────────

export default function OmniFlowDiagram({
  graph,
  flowLabel,
}: {
  graph: FlowGraphWithPath;
  flowLabel: string | null;
}) {
  const pathSet = new Set(graph.inferredPath ?? []);

  const positions = computeLayout(graph.nodes, graph.edges, graph.startNodeName);

  const rfNodes: Node<FlowNodeData>[] = graph.nodes.map((n) => {
    const pos = positions.get(n.name) ?? { x: 0, y: 0 };
    const onPath = pathSet.has(n.name);
    const isTerminal = n.kind === "routeWork" && n.name === graph.matchedRouteWorkName;
    const type =
      n.kind === "start" ? "startNode" : n.kind === "decision" ? "decisionNode" : "actionNode";
    return {
      id: n.name,
      type,
      position: pos,
      data: { flowNode: n, onPath, isTerminal },
    };
  });

  const rfEdges: Edge[] = graph.edges.map((e) => {
    const fromOnPath = pathSet.has(e.from);
    const toOnPath = pathSet.has(e.to);
    const onPath = fromOnPath && toOnPath;
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      label: e.label && !onPath ? e.label : undefined,
      style: {
        stroke: onPath ? "#0070d2" : "#cbd5e1",
        strokeWidth: onPath ? 2 : 1,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: onPath ? "#0070d2" : "#cbd5e1",
      },
      type: "smoothstep",
    };
  });

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">
          {flowLabel ?? "Omni-Channel Flow"}
        </p>
        {graph.inferredPath ? (
          <span className="text-[9px] font-mono text-brand-500 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded-full border border-brand-200 dark:border-brand-800">
            Inferred path · {graph.matchConfidence} confidence
          </span>
        ) : (
          <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
            Full flow — path not inferred
          </span>
        )}
      </div>
      <div style={{ height: 380 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          panOnDrag={true}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        />
      </div>
    </div>
  );
}

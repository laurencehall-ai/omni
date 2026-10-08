export type TopologyColumnId =
  | "channel"
  | "routingConfig"
  | "agent"
  | "skill"
  | "flow"
  | "queue"
  | "object";

export interface TopologyNode {
  id: string;
  label: string;
  columnId: TopologyColumnId;
  meta?: Record<string, string | number | boolean | null>;
}

export interface TopologyEdge {
  from: string;
  to: string;
  fromColumn: TopologyColumnId;
  toColumn: TopologyColumnId;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  unavailableObjects: string[];
}

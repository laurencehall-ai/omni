// ─── Flow graph parser and path inference ────────────────────────────────────
// Converts raw Salesforce Flow Metadata into a graph (nodes + edges) and
// infers which path a specific AgentWork record took through the flow.

import {
  FlowMetadata,
  FlowInputParameter,
  ParsedFlowGraph,
  FlowGraphWithPath,
  FlowNode,
  FlowNodeKind,
  FlowEdge,
} from "./flow-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getParam(params: FlowInputParameter[], name: string): string | null {
  const p = params.find((x) => x.name === name);
  if (!p?.value) return null;
  return p.value.stringValue ?? p.value.setupReference ?? null;
}

function actionKind(actionType: string): FlowNodeKind {
  if (actionType === "checkAvailabilityForRouting") return "checkAvailability";
  if (actionType === "routeWork") return "routeWork";
  if (actionType === "playPromptAsyncAction") return "playPrompt";
  if (actionType === "addScreenPop") return "screenPop";
  return "other";
}

// ─── Parse ────────────────────────────────────────────────────────────────────

export function parseFlowGraph(metadata: FlowMetadata): ParsedFlowGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Synthetic start node
  const START = "__start__";
  nodes.push({ name: START, label: "Start", kind: "start" });

  // Wire start node to first real node
  const firstRef =
    metadata.startElementReference ??
    metadata.start?.connector?.targetReference ??
    null;
  if (firstRef) {
    edges.push({ id: `${START}->${firstRef}`, from: START, to: firstRef });
  }

  // Action calls
  for (const ac of metadata.actionCalls ?? []) {
    const kind = actionKind(ac.actionType);
    const node: FlowNode = {
      name: ac.name,
      label: ac.label ?? ac.name,
      kind,
    };
    if (kind === "routeWork") {
      node.queueId = getParam(ac.inputParameters, "queueId") ?? undefined;
      node.queueLabel = getParam(ac.inputParameters, "queueLabel") ?? undefined;
      node.routingType = getParam(ac.inputParameters, "routingType") ?? undefined;
      node.copilotLabel = getParam(ac.inputParameters, "copilotLabel") ?? undefined;
    }
    if (kind === "checkAvailability") {
      node.checkQueueId = getParam(ac.inputParameters, "queueId") ?? undefined;
      node.checkQueueLabel = getParam(ac.inputParameters, "queueLabel") ?? undefined;
    }
    nodes.push(node);

    if (ac.connector?.targetReference) {
      edges.push({
        id: `${ac.name}->${ac.connector.targetReference}`,
        from: ac.name,
        to: ac.connector.targetReference,
      });
    }
    if (ac.timeoutConnector?.targetReference) {
      edges.push({
        id: `${ac.name}->timeout->${ac.timeoutConnector.targetReference}`,
        from: ac.name,
        to: ac.timeoutConnector.targetReference,
        label: "Timeout",
        isTimeout: true,
      });
    }
  }

  // Decisions
  for (const dec of metadata.decisions ?? []) {
    nodes.push({ name: dec.name, label: dec.label ?? dec.name, kind: "decision" });

    for (const rule of dec.rules ?? []) {
      if (rule.connector?.targetReference) {
        edges.push({
          id: `${dec.name}->${rule.name}->${rule.connector.targetReference}`,
          from: dec.name,
          to: rule.connector.targetReference,
          label: rule.label ?? rule.name,
        });
      }
    }
    if (dec.defaultConnector?.targetReference) {
      edges.push({
        id: `${dec.name}->default->${dec.defaultConnector.targetReference}`,
        from: dec.name,
        to: dec.defaultConnector.targetReference,
        label: dec.defaultConnectorLabel ?? "Default",
        isDefault: true,
      });
    }
  }

  return { nodes, edges, startNodeName: START };
}

// ─── Path inference ───────────────────────────────────────────────────────────

export function inferPath(
  graph: ParsedFlowGraph,
  originalQueueId: string | null,
  routingType: string | null,
): FlowGraphWithPath {
  const routeWorkNodes = graph.nodes.filter((n) => n.kind === "routeWork");

  let matched: FlowNode | null = null;
  let matchConfidence: "high" | "medium" | "low" | null = null;

  // High confidence: queue ID match
  if (originalQueueId) {
    const byQueue = routeWorkNodes.filter((n) => n.queueId === originalQueueId);
    if (byQueue.length === 1) {
      matched = byQueue[0];
      matchConfidence = "high";
    }
  }

  // Medium confidence: routing type match
  if (!matched && routingType) {
    const byType = routeWorkNodes.filter(
      (n) => n.routingType?.toLowerCase() === routingType.toLowerCase(),
    );
    if (byType.length === 1) {
      matched = byType[0];
      matchConfidence = "medium";
    }
  }

  // Low confidence: only one routeWork in the flow
  if (!matched && routeWorkNodes.length === 1) {
    matched = routeWorkNodes[0];
    matchConfidence = "low";
  }

  if (!matched) {
    return { ...graph, inferredPath: null, matchedRouteWorkName: null, matchConfidence: null };
  }

  // BFS from start to matched node
  const adjMap = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!adjMap.has(edge.from)) adjMap.set(edge.from, []);
    adjMap.get(edge.from)!.push(edge.to);
  }

  const visited = new Set<string>();
  const prev = new Map<string, string>();
  const queue: string[] = [graph.startNodeName];
  visited.add(graph.startNodeName);

  outer: while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === matched.name) break;
    for (const next of adjMap.get(curr) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        prev.set(next, curr);
        queue.push(next);
        if (next === matched.name) break outer;
      }
    }
  }

  // Reconstruct path
  const path: string[] = [];
  let cur: string | undefined = matched.name;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur);
  }

  // Path is valid only if it starts at the start node
  const inferredPath = path[0] === graph.startNodeName ? path : null;

  return {
    ...graph,
    inferredPath,
    matchedRouteWorkName: matched.name,
    matchConfidence,
  };
}

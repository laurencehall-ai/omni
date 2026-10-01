// ─── Flow Metadata types from Salesforce Tooling API ─────────────────────────
// Shapes returned by GET /tooling/sobjects/Flow/{versionId} Metadata field.
// Based on the actual response structure observed from the debug/flow spike.

export interface FlowValue {
  stringValue: string | null;
  booleanValue: boolean | null;
  numberValue: number | null;
  elementReference: string | null;
  setupReference: string | null;
  setupReferenceType: string | null;
  apexValue: null;
  dateValue: null;
  dateTimeValue: null;
  sobjectValue: null;
  formulaExpression: string | null;
  formulaDataType: string | null;
  transform: null;
  transformValueReference: null;
}

export interface FlowInputParameter {
  name: string;
  processMetadataValues: unknown[];
  value: FlowValue | null;
}

export interface FlowConnectorRef {
  targetReference: string;
  isGoTo: boolean | null;
  processMetadataValues: unknown[];
}

export interface FlowActionCall {
  name: string;
  label: string | null;
  actionName: string;
  actionType: string;
  connector: FlowConnectorRef | null;
  timeoutConnector: FlowConnectorRef | null;
  faultConnector: FlowConnectorRef | null;
  inputParameters: FlowInputParameter[];
  outputParameters: unknown[];
  locationX: number;
  locationY: number;
  isWaitUntilCompleted: boolean | null;
}

export interface FlowRule {
  name: string;
  label: string | null;
  connector: FlowConnectorRef | null;
  conditions: unknown[];
}

export interface FlowDecision {
  name: string;
  label: string | null;
  rules: FlowRule[];
  defaultConnector: FlowConnectorRef | null;
  defaultConnectorLabel: string | null;
  locationX: number;
  locationY: number;
}

export interface FlowStart {
  connector: FlowConnectorRef | null;
  locationX: number;
  locationY: number;
}

export interface FlowMetadata {
  actionCalls: FlowActionCall[] | null;
  decisions: FlowDecision[] | null;
  start: FlowStart | null;
  startElementReference: string | null;
  processType: string | null;
  label: string | null;
  description: string | null;
  variables: unknown[] | null;
  formulas: unknown[] | null;
}

export interface FlowRecord {
  Id: string;
  FullName: string;
  Metadata: FlowMetadata;
}

// ─── Parsed graph types ───────────────────────────────────────────────────────

export type FlowNodeKind =
  | "start"
  | "checkAvailability"
  | "routeWork"
  | "playPrompt"
  | "screenPop"
  | "decision"
  | "other";

export interface FlowNode {
  name: string;
  label: string;
  kind: FlowNodeKind;
  // routeWork fields
  queueId?: string;
  queueLabel?: string;
  routingType?: string;
  copilotLabel?: string;
  // checkAvailability fields
  checkQueueId?: string;
  checkQueueLabel?: string;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  isDefault?: boolean;
  isTimeout?: boolean;
}

export interface ParsedFlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  startNodeName: string;
}

export interface FlowGraphWithPath extends ParsedFlowGraph {
  inferredPath: string[] | null;
  matchedRouteWorkName: string | null;
  matchConfidence: "high" | "medium" | "low" | null;
}

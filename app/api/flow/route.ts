// GET /api/flow?agentWorkId=X
//
// Returns the parsed OmniFlow routing graph for the given AgentWork, with the
// inferred path the work item took through the flow highlighted.
//
// Strategy:
//   1. Fetch AgentWork to get OriginalQueueId and RoutingType
//   2. Fetch all active RoutingFlow versions (deduped to latest per definition)
//   3. For each, fetch the Flow Metadata record (cached 1h — flows change rarely)
//   4. Parse the graph and infer path for each candidate
//   5. Return the first match (or notFound if no flow matches)

import { NextRequest, NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { sfQuery, sfToolingQuery, sfToolingGet } from "@/lib/salesforce";
import { parseFlowGraph, inferPath } from "@/lib/flow-graph";
import { FlowRecord, FlowGraphWithPath } from "@/lib/flow-types";

interface RawAgentWork {
  Id: string;
  OriginalQueueId: string | null;
  RoutingType: string | null;
}

interface FlowVersionRow {
  Id: string;
  DefinitionId: string;
  VersionNumber: number;
  Status: string;
}

interface FlowDefinitionRow {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
}

export async function GET(req: NextRequest) {
  try {
    const org = await getOrgOrThrow();
    const agentWorkId = new URL(req.url).searchParams.get("agentWorkId");
    if (!agentWorkId) {
      return NextResponse.json({ error: "Missing agentWorkId" }, { status: 400 });
    }

    // 1. Fetch AgentWork
    const [aw] = await sfQuery<RawAgentWork>(
      org,
      `SELECT Id, OriginalQueueId, RoutingType FROM AgentWork WHERE Id = '${agentWorkId}' LIMIT 1`,
    );
    if (!aw) {
      return NextResponse.json({ error: "AgentWork not found" }, { status: 404 });
    }

    // 2. Fetch all active RoutingFlow versions, dedupe to latest per DefinitionId
    const versions = await sfToolingQuery<FlowVersionRow>(
      org,
      `SELECT Id, DefinitionId, VersionNumber, Status
       FROM Flow
       WHERE ProcessType = 'RoutingFlow' AND Status = 'Active'
       ORDER BY DefinitionId, VersionNumber DESC
       LIMIT 100`,
    );

    const seen = new Set<string>();
    const uniqueVersions = versions.filter((v) => {
      if (seen.has(v.DefinitionId)) return false;
      seen.add(v.DefinitionId);
      return true;
    });

    if (!uniqueVersions.length) {
      return NextResponse.json({
        notFound: true,
        reason: "No active RoutingFlow versions found in this org",
      });
    }

    // 3. For each flow, fetch Metadata and try to match
    let bestMatch: {
      graph: FlowGraphWithPath;
      definitionId: string;
      developerName: string | null;
      flowLabel: string | null;
    } | null = null;

    for (const version of uniqueVersions) {
      let flowRecord: FlowRecord;
      try {
        flowRecord = await sfToolingGet<FlowRecord>(
          org,
          `/sobjects/Flow/${version.Id}`,
          3600, // cache flow definitions for 1 hour
        );
      } catch {
        continue; // skip if this version can't be fetched
      }

      if (!flowRecord.Metadata) continue;

      const graph = parseFlowGraph(flowRecord.Metadata);
      const graphWithPath = inferPath(graph, aw.OriginalQueueId, aw.RoutingType);

      if (graphWithPath.inferredPath !== null) {
        bestMatch = {
          graph: graphWithPath,
          definitionId: version.DefinitionId,
          developerName: null,
          flowLabel: flowRecord.Metadata.label ?? flowRecord.FullName ?? null,
        };
        break; // first match wins
      }
    }

    if (!bestMatch) {
      return NextResponse.json({
        notFound: true,
        reason: "No RoutingFlow matched this work item's queue or routing type",
      });
    }

    // 4. Resolve FlowDefinition developer name
    try {
      const [def] = await sfToolingQuery<FlowDefinitionRow>(
        org,
        `SELECT Id, DeveloperName, MasterLabel FROM FlowDefinition WHERE Id = '${bestMatch.definitionId}' LIMIT 1`,
      );
      if (def) {
        bestMatch.developerName = def.DeveloperName;
        bestMatch.flowLabel = def.MasterLabel ?? bestMatch.flowLabel;
      }
    } catch {
      // non-fatal — we already have the graph
    }

    return NextResponse.json({
      graph: bestMatch.graph,
      flowDeveloperName: bestMatch.developerName,
      flowLabel: bestMatch.flowLabel,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// Tooling API spike endpoint for OmniFlow introspection.
// Queries FlowDefinition, FlowVersion, FlowElement, and FlowConnector for an
// OmniFlow by name (or lists all OmniFlows if no name given).
//
// Usage:
//   GET /api/debug/flow                      → list all active OmniFlows in the org
//   GET /api/debug/flow?name=My_OmniFlow     → get full element + connector graph for that flow
//
// REMOVE before any public release — raw flow structure, internal IDs exposed.

import { NextRequest, NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { sfToolingQuery } from "@/lib/salesforce";

const API_VERSION = "v62.0";

interface FlowDefRow {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
  Description: string | null;
  ActiveVersionId: string | null;
  LatestVersionId: string | null;
}

interface FlowVersionRow {
  Id: string;
  VersionNumber: number;
  Status: string;
  CreatedDate: string;
  LastModifiedDate: string;
}

interface FlowElementRow {
  Id: string;
  Name: string;
  Label: string | null;
  Type: string;
  Subtype: string | null;
  ElementSubtype: string | null;
  ProcessMetadataValues: unknown;
}

interface FlowConnectorRow {
  Id: string;
  Name: string;
  SourceElementId: string;
  TargetElementId: string;
  ConnectorLabel: string | null;
  IsDefaultFlow: boolean;
}

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tooling API error (${res.status}): ${body}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  const org = await getOrgOrThrow();
  const { searchParams } = new URL(req.url);
  const flowName = searchParams.get("name");

  if (!flowName) {
    // List all OmniFlows in the org
    const defs = await sfToolingQuery<FlowDefRow>(
      org,
      `SELECT Id, DeveloperName, MasterLabel, Description, ActiveVersionId, LatestVersionId
       FROM FlowDefinition
       WHERE ProcessType = 'OmniChannelFlow'
       LIMIT 50`,
    );
    return NextResponse.json({
      count: defs.length,
      flows: defs.map((d) => ({
        id: d.Id,
        developerName: d.DeveloperName,
        label: d.MasterLabel,
        description: d.Description,
        activeVersionId: d.ActiveVersionId,
        latestVersionId: d.LatestVersionId,
      })),
      hint: "Add ?name=DeveloperName to get full element + connector graph",
    });
  }

  // Fetch the named flow's definition
  const defs = await sfToolingQuery<FlowDefRow>(
    org,
    `SELECT Id, DeveloperName, MasterLabel, Description, ActiveVersionId, LatestVersionId
     FROM FlowDefinition
     WHERE DeveloperName = '${flowName.replace(/'/g, "\\'")}'
     LIMIT 1`,
  );

  if (!defs.length) {
    return NextResponse.json(
      { error: `No FlowDefinition found with DeveloperName = '${flowName}'` },
      { status: 404 },
    );
  }

  const def = defs[0];
  const versionId = def.ActiveVersionId ?? def.LatestVersionId;

  if (!versionId) {
    return NextResponse.json(
      { error: "Flow has no active or latest version", flow: def },
      { status: 422 },
    );
  }

  // Fetch version metadata
  const versionUrl = `${org.instanceUrl}/services/data/${API_VERSION}/tooling/sobjects/FlowVersion/${versionId}`;
  let version: FlowVersionRow | null = null;
  try {
    version = await fetchJson(versionUrl, org.accessToken);
  } catch {
    // non-fatal — proceed without version metadata
  }

  // Fetch all elements (nodes)
  let elements: FlowElementRow[] = [];
  try {
    elements = await sfToolingQuery<FlowElementRow>(
      org,
      `SELECT Id, Name, Label, Type, Subtype, ElementSubtype, ProcessMetadataValues
       FROM FlowElement
       WHERE FlowVersionId = '${versionId}'
       ORDER BY Name
       LIMIT 500`,
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: `FlowElement query failed: ${e instanceof Error ? e.message : String(e)}`,
        flowId: def.Id,
        versionId,
      },
      { status: 500 },
    );
  }

  // Fetch all connectors (edges)
  let connectors: FlowConnectorRow[] = [];
  try {
    connectors = await sfToolingQuery<FlowConnectorRow>(
      org,
      `SELECT Id, Name, SourceElementId, TargetElementId, ConnectorLabel, IsDefaultFlow
       FROM FlowConnector
       WHERE FlowVersionId = '${versionId}'
       ORDER BY SourceElementId
       LIMIT 500`,
    );
  } catch {
    // FlowConnector may not be queryable in all orgs — soft-fail
    connectors = [];
  }

  // Group elements by type for easier inspection
  const byType: Record<string, FlowElementRow[]> = {};
  for (const el of elements) {
    byType[el.Type] = byType[el.Type] ?? [];
    byType[el.Type].push(el);
  }

  return NextResponse.json({
    flow: {
      id: def.Id,
      developerName: def.DeveloperName,
      label: def.MasterLabel,
      description: def.Description,
    },
    version: version
      ? {
          id: versionId,
          number: version.VersionNumber,
          status: version.Status,
          createdDate: version.CreatedDate,
          lastModifiedDate: version.LastModifiedDate,
        }
      : { id: versionId },
    elementCount: elements.length,
    connectorCount: connectors.length,
    elementTypesSummary: Object.fromEntries(
      Object.entries(byType).map(([type, els]) => [type, els.length]),
    ),
    elements,
    connectors,
  });
}

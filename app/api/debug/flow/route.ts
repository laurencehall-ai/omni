// Tooling API spike endpoint for OmniFlow introspection.
// REMOVE before any public release — raw flow structure, internal IDs exposed.
//
// Usage:
//   GET /api/debug/flow                      → list all FlowDefinitions in the org
//   GET /api/debug/flow?name=My_OmniFlow     → full element + connector graph

import { NextRequest, NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { sfToolingQuery } from "@/lib/salesforce";

interface FlowDefRow {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
  Description: string | null;
}

interface FlowRow {
  Id: string;
  DefinitionId: string;
  VersionNumber: number;
  Status: string;
  ProcessType: string;
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

export async function GET(req: NextRequest) {
  try {
    const org = await getOrgOrThrow();
    const { searchParams } = new URL(req.url);
    const flowName = searchParams.get("name");

    if (!flowName) {
      // Flow (not FlowVersion) is the correct Tooling API object for versioned flows
      // ProcessType value is "OmniChannelFlow" (no spaces/hyphens in the API value)
      // Try both known variants since different orgs may report differently
      let flows: FlowRow[] = [];
      let usedProcessType = "";
      for (const pt of ["OmniChannelFlow", "Omni-Channel Flow", "OmniChannel"]) {
        try {
          flows = await sfToolingQuery<FlowRow>(
            org,
            `SELECT Id, DefinitionId, VersionNumber, Status, ProcessType
             FROM Flow
             WHERE ProcessType = '${pt}'
             ORDER BY DefinitionId, VersionNumber DESC
             LIMIT 100`,
          );
          if (flows.length > 0) { usedProcessType = pt; break; }
          usedProcessType = pt;
        } catch {
          // try next value
        }
      }

      // Dedupe to one entry per DefinitionId (latest version)
      const seen = new Set<string>();
      const unique = flows.filter((v) => {
        if (seen.has(v.DefinitionId)) return false;
        seen.add(v.DefinitionId);
        return true;
      });

      // Fetch DeveloperNames
      const defIds = unique.map((v) => `'${v.DefinitionId}'`).join(", ");
      const defs = defIds.length
        ? await sfToolingQuery<FlowDefRow>(
            org,
            `SELECT Id, DeveloperName, MasterLabel
             FROM FlowDefinition
             WHERE Id IN (${defIds})`,
          )
        : [];

      const defMap = Object.fromEntries(defs.map((d) => [d.Id, d]));

      return NextResponse.json({
        count: unique.length,
        usedProcessType,
        omniChannelFlows: unique.map((v) => ({
          definitionId: v.DefinitionId,
          developerName: defMap[v.DefinitionId]?.DeveloperName ?? null,
          label: defMap[v.DefinitionId]?.MasterLabel ?? null,
          latestVersionId: v.Id,
          latestVersionNumber: v.VersionNumber,
          status: v.Status,
        })),
        hint: "Add ?name=DeveloperName to get full element + connector graph",
      });
    }

    // Look up the named flow
    const defs = await sfToolingQuery<FlowDefRow>(
      org,
      `SELECT Id, DeveloperName, MasterLabel, Description
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

    // Get active version, fall back to latest
    let versionRows: FlowVersionRow[] = [];
    try {
      versionRows = await sfToolingQuery<FlowVersionRow>(
        org,
        `SELECT Id, VersionNumber, Status, CreatedDate, LastModifiedDate
         FROM Flow
         WHERE DefinitionId = '${def.Id}'
         AND Status = 'Active'
         LIMIT 1`,
      );
    } catch {
      // Active query failed — try latest regardless of status
    }

    if (!versionRows.length) {
      versionRows = await sfToolingQuery<FlowVersionRow>(
        org,
        `SELECT Id, VersionNumber, Status, CreatedDate, LastModifiedDate
         FROM Flow
         WHERE DefinitionId = '${def.Id}'
         ORDER BY VersionNumber DESC
         LIMIT 1`,
      );
    }

    if (!versionRows.length) {
      return NextResponse.json(
        { error: "No Flow version found for this flow", flow: def },
        { status: 422 },
      );
    }

    const version = versionRows[0];

    // Fetch elements (nodes)
    let elements: FlowElementRow[] = [];
    let elementError: string | null = null;
    try {
      elements = await sfToolingQuery<FlowElementRow>(
        org,
        `SELECT Id, Name, Label, Type, Subtype, ElementSubtype, ProcessMetadataValues
         FROM FlowElement
         WHERE FlowVersionId = '${version.Id}'
         ORDER BY Name
         LIMIT 500`,
      );
    } catch (e) {
      elementError = e instanceof Error ? e.message : String(e);
    }

    // Fetch connectors (edges) — soft-fail, not all orgs expose this
    let connectors: FlowConnectorRow[] = [];
    let connectorError: string | null = null;
    try {
      connectors = await sfToolingQuery<FlowConnectorRow>(
        org,
        `SELECT Id, Name, SourceElementId, TargetElementId, ConnectorLabel, IsDefaultFlow
         FROM FlowConnector
         WHERE FlowVersionId = '${version.Id}'
         ORDER BY SourceElementId
         LIMIT 500`,
      );
    } catch (e) {
      connectorError = e instanceof Error ? e.message : String(e);
    }

    const byType: Record<string, number> = {};
    for (const el of elements) {
      byType[el.Type] = (byType[el.Type] ?? 0) + 1;
    }

    return NextResponse.json({
      flow: {
        id: def.Id,
        developerName: def.DeveloperName,
        label: def.MasterLabel,
        description: def.Description,
      },
      version: {
        id: version.Id,
        number: version.VersionNumber,
        status: version.Status,
        createdDate: version.CreatedDate,
        lastModifiedDate: version.LastModifiedDate,
      },
      elementCount: elements.length,
      connectorCount: connectors.length,
      elementTypesSummary: byType,
      ...(elementError ? { elementError } : {}),
      ...(connectorError ? { connectorError } : {}),
      elements,
      connectors,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

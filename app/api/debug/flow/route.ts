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
  try {
    const org = await getOrgOrThrow();
    const { searchParams } = new URL(req.url);
    const flowName = searchParams.get("name");

    if (!flowName) {
      // ProcessType = 'RoutingFlow' is the correct value for OmniChannel routing flows
      const flows = await sfToolingQuery<FlowRow>(
        org,
        `SELECT Id, DefinitionId, VersionNumber, Status, ProcessType
         FROM Flow
         WHERE ProcessType = 'RoutingFlow'
         AND Status = 'Active'
         ORDER BY DefinitionId, VersionNumber DESC
         LIMIT 100`,
      );

      // Dedupe to latest active version per DefinitionId
      const seen = new Set<string>();
      const unique = flows.filter((v) => {
        if (seen.has(v.DefinitionId)) return false;
        seen.add(v.DefinitionId);
        return true;
      });

      // Fetch DeveloperNames for those definitions
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
        routingFlows: unique.map((v) => ({
          developerName: defMap[v.DefinitionId]?.DeveloperName ?? null,
          label: defMap[v.DefinitionId]?.MasterLabel ?? null,
          versionId: v.Id,
          versionNumber: v.VersionNumber,
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

    // FlowElement/FlowConnector aren't queryable via SOQL in all orgs.
    // Use direct REST GET on the Flow sObject — returns full Metadata field with all nodes.
    const flowUrl = `${org.instanceUrl}/services/data/v62.0/tooling/sobjects/Flow/${version.Id}`;
    const flowRecord = await fetchJson(flowUrl, org.accessToken);

    // The Metadata field contains the full flow definition including elements
    const metadata = flowRecord.Metadata ?? null;
    const elements: unknown[] = metadata?.actionCalls
      ?? metadata?.decisions
      ?? null;

    // Summarise top-level keys in Metadata so we can see what's available
    const metadataKeys = metadata ? Object.keys(metadata) : [];
    const elementTypeSummary: Record<string, number> = {};
    if (metadata) {
      for (const key of metadataKeys) {
        const val = metadata[key];
        if (Array.isArray(val) && val.length > 0) {
          elementTypeSummary[key] = val.length;
        }
      }
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
      metadataKeys,
      elementTypeSummary,
      metadata,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

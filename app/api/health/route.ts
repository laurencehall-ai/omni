// GET /api/health
//
// Returns open PendingServiceRouting records — PSRs that have not yet been
// routed to an agent. A PSR is "open" when it has no corresponding AgentWork
// yet (i.e. still waiting in the routing engine).
//
// PendingServiceRouting is a transient object. Records here represent work
// items currently stuck waiting to be dispatched. Admins should investigate
// any PSR that has been open for more than a few minutes.

import { NextResponse } from "next/server";
import { getOrgOrThrow } from "@/lib/session";
import { sfQuery } from "@/lib/salesforce";

export interface PsrRecord {
  id: string;
  workItemId: string;
  workItemType: string; // inferred from workItemId prefix
  queueId: string | null;
  queueName: string | null;
  routingPriority: number | null;
  capacityWeight: number | null;
  isReadyForRouting: boolean;
  isPushed: boolean;
  createdDate: string;
  ageMinutes: number; // computed server-side from createdDate
}

interface RawPsr {
  Id: string;
  WorkItemId: string;
  QueueId: string | null;
  RoutingPriority: number | null;
  CapacityWeight: number | null;
  IsReadyForRouting: boolean;
  IsPushed: boolean;
  CreatedDate: string;
}

interface RawGroup {
  Id: string;
  Name: string;
}

const WORK_ITEM_PREFIXES: Record<string, string> = {
  "500": "Case",
  "570": "Live Chat",
  "0Mh": "Messaging Session",
  "0Oc": "Voice Call",
  "00Q": "Lead",
};

function workItemTypeFromId(id: string): string {
  const prefix = id.substring(0, 3);
  return WORK_ITEM_PREFIXES[prefix] ?? "Work Item";
}

export async function GET() {
  try {
    const org = await getOrgOrThrow();

    // Fetch all open PSRs — no Status filter needed, existence = open/pending
    const psrs = await sfQuery<RawPsr>(
      org,
      `SELECT Id, WorkItemId, QueueId, RoutingPriority, CapacityWeight,
              IsReadyForRouting, IsPushed, CreatedDate
       FROM PendingServiceRouting
       ORDER BY CreatedDate ASC
       LIMIT 200`,
    );

    if (psrs.length === 0) {
      return NextResponse.json({ psrs: [], queueNames: {} });
    }

    // Resolve queue names in one batch query
    const queueIds = Array.from(
      new Set(psrs.map((p) => p.QueueId).filter(Boolean) as string[]),
    );

    let queueNames: Record<string, string> = {};
    if (queueIds.length > 0) {
      try {
        const ids = queueIds.map((id) => `'${id}'`).join(",");
        const groups = await sfQuery<RawGroup>(
          org,
          `SELECT Id, Name FROM Group WHERE Id IN (${ids})`,
        );
        queueNames = Object.fromEntries(groups.map((g) => [g.Id, g.Name]));
      } catch {
        // queue names fall back to IDs if Group query fails
      }
    }

    const now = Date.now();

    const result: PsrRecord[] = psrs.map((p) => {
      const createdMs = new Date(p.CreatedDate).getTime();
      const ageMinutes = Math.floor((now - createdMs) / 60_000);
      return {
        id: p.Id,
        workItemId: p.WorkItemId,
        workItemType: workItemTypeFromId(p.WorkItemId),
        queueId: p.QueueId,
        queueName: p.QueueId ? (queueNames[p.QueueId] ?? p.QueueId) : null,
        routingPriority: p.RoutingPriority,
        capacityWeight: p.CapacityWeight,
        isReadyForRouting: p.IsReadyForRouting,
        isPushed: p.IsPushed,
        createdDate: p.CreatedDate,
        ageMinutes,
      };
    });

    return NextResponse.json({ psrs: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("No org connected") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

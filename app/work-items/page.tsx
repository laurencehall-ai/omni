"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WorkItemRow } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/utils";
import { getValidations, clearValidations } from "@/lib/validations";

type SortKey = keyof Pick<WorkItemRow, "channelLabel" | "queueName" | "agentName" | "routingModel" | "routingType" | "status" | "createdDate" | "timeToAcceptSeconds">;
type SortDir = "asc" | "desc";

const ROUTING_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  QueueBased:      { label: "Queue",    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  Queue:           { label: "Queue",    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  SkillsBased:     { label: "Skills",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  ExternalRouting: { label: "External", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  OmniFlow:        { label: "Flow",     color: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300" },
};

function routingTypeBadge(rt: string) {
  const entry = ROUTING_TYPE_LABELS[rt];
  return entry ?? { label: rt, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" };
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <span className="text-slate-400 ml-1 opacity-40">↕</span>;
  return <span className="ml-1 text-brand-400">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function sortRows(rows: WorkItemRow[], key: SortKey, dir: SortDir): WorkItemRow[] {
  return [...rows].sort((a, b) => {
    const av = a[key] ?? "";
    const bv = b[key] ?? "";
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });
}

export default function WorkItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<WorkItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");
  const [orgLabel, setOrgLabel] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("createdDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [validatedIds, setValidatedIds] = useState<Set<string>>(new Set());

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: String(days) });
      const res = await fetch(`/api/work-items?${params}`);
      if (res.status === 401) { router.push("/connect"); return; }
      if (!res.ok) throw new Error((await res.json()).error);
      setItems(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load work items");
    } finally {
      setLoading(false);
    }
  }, [days, router]);

  useEffect(() => {
    fetch("/api/org").then((r) => r.json()).then((d) => {
      if (!d.connected) { router.push("/connect"); return; }
      setOrgLabel(d.label);
    });
  }, [router]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => { setValidatedIds(getValidations()); }, []);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/auth/disconnect", { method: "POST" });
    router.push("/connect");
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter(item =>
        item.channelLabel?.toLowerCase().includes(q) ||
        item.queueName?.toLowerCase().includes(q) ||
        item.agentName?.toLowerCase().includes(q) ||
        item.routingModel?.toLowerCase().includes(q) ||
        item.status?.toLowerCase().includes(q)
      )
    : items;
  const sorted = sortRows(filtered, sortKey, sortDir);

  const columns: { key: SortKey; label: string }[] = [
    { key: "channelLabel",       label: "Channel" },
    { key: "queueName",          label: "Queue" },
    { key: "agentName",          label: "Agent" },
    { key: "routingModel",       label: "Routing Model" },
    { key: "routingType",        label: "Routing Method" },
    { key: "status",             label: "Status" },
    { key: "createdDate",        label: "Created" },
    { key: "timeToAcceptSeconds", label: "Time to Accept" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Work Items</h1>
          {orgLabel && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Connected to: <span className="font-medium">{orgLabel}</span>
            </p>
          )}
        </div>
        <button onClick={handleDisconnect} disabled={disconnecting}
          className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline">
          Disconnect
        </button>
      </div>

      {/* Direction hint */}
      {!loading && items.length > 0 && (
        <p className="text-sm font-semibold text-brand-500 dark:text-brand-400 mb-4">
          ↓ Click a work item to trace its routing
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by channel, queue, agent, status…"
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400 dark:placeholder-slate-500"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg leading-none">
              ×
            </button>
          )}
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
        <button onClick={fetchItems}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
          Refresh
        </button>
        {validatedIds.size > 0 && (
          <button
            onClick={() => { clearValidations(); setValidatedIds(new Set()); }}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors self-center">
            Reset validations
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading work items…</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          {q ? `No work items match "${search}"` : "No work items found for the selected time range."}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3 select-none whitespace-nowrap">
                  Ref
                </th>
                {columns.map(({ key, label }) => (
                  <th key={key}
                    onClick={() => handleSort(key)}
                    className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-brand-500 dark:hover:text-brand-400 select-none whitespace-nowrap">
                    {label}<SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, i) => {
                const badge = routingTypeBadge(item.routingType);
                return (
                  <tr key={item.id}
                    onClick={() => router.push(`/trace/${item.id}`)}
                    className={`cursor-pointer hover:bg-brand-50 dark:hover:bg-slate-800 transition-colors ${
                      i !== sorted.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""
                    }`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {item.workItemType.slice(0,1)}·{item.workItemRef}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.channelLabel}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.queueName}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {item.agentName}
                      {validatedIds.has(item.id) && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">✓ validated</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {item.routingModel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === "Opened" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{formatDate(item.createdDate)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {item.timeToAcceptSeconds != null ? formatDuration(item.timeToAcceptSeconds) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

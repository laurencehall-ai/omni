"use client";

// ─── CorrectionPanel ──────────────────────────────────────────────────────────
// Form where the admin describes how a work item should have routed.
// The admin picks a target type (specific agent, specific queue, or skills-based),
// selects the intended target via typeahead, adds an optional reason,
// then submits to /api/suggest to get configuration recommendations.
//
// The reason field shows a reminder not to include customer names or case details.

import { useState, useEffect, useRef } from "react";
import { CorrectionInput, AgentOption, QueueOption } from "@/lib/types";

type TargetType = "agent" | "queue" | "skills";

interface Props {
  onSubmit: (correction: CorrectionInput) => void;
  loading: boolean;
  error: string | null;
}

// ─── useTypeahead ─────────────────────────────────────────────────────────────
// Debounced typeahead hook that fetches suggestions from an API endpoint.
// Only fires when `active` is true (i.e. the parent field is visible).
// Debounce delay: 300ms to avoid hammering the SF API on every keystroke.
function useTypeahead<T extends { id: string; name: string }>(
  endpoint: string,
  active: boolean,
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [selected, setSelected] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Don't fetch if inactive, empty, or user just selected an item (query === selected.name)
    if (!active || !query || selected?.name === query) {
      setResults([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        setResults(await res.json());
        setOpen(true);
      }
    }, 300);
  }, [query, selected, endpoint, active]);

  // Called when the user clicks a result — locks in the selection
  function choose(item: T) {
    setSelected(item);
    setQuery(item.name);
    setResults([]);
    setOpen(false);
  }

  // Called when the X button is clicked — resets the field
  function clear() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return { query, setQuery, results, selected, open, setOpen, choose, clear };
}

// ─── CorrectionPanel ─────────────────────────────────────────────────────────

export default function CorrectionPanel({ onSubmit, loading, error }: Props) {
  const [targetType, setTargetType] = useState<TargetType | null>(null);
  const [reason, setReason] = useState("");
  // Skills-based routing tab only shown when org has Skills configured
  const [skillsEnabled, setSkillsEnabled] = useState(false);

  // Check whether skills are configured in this org on mount
  useEffect(() => {
    fetch("/api/org/capabilities")
      .then((r) => (r.ok ? r.json() : { skillsEnabled: false }))
      .then((d) => setSkillsEnabled(!!d.skillsEnabled))
      .catch(() => setSkillsEnabled(false));
  }, []);

  // Each typeahead is only active when its tab is selected
  const agent = useTypeahead<AgentOption>(
    "/api/agents",
    targetType === "agent",
  );
  const queue = useTypeahead<QueueOption>(
    "/api/queues",
    targetType === "queue",
  );
  const [skillsNote, setSkillsNote] = useState("");

  // Switching tabs clears the previous selection
  function handleTypeChange(type: TargetType) {
    setTargetType(type);
    agent.clear();
    queue.clear();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (targetType === "agent" && !agent.selected) return;
    if (targetType === "queue" && !queue.selected) return;

    onSubmit({
      targetAgentId: targetType === "agent" ? agent.selected?.id : undefined,
      targetAgentName:
        targetType === "agent" ? agent.selected?.name : undefined,
      targetQueueId: targetType === "queue" ? queue.selected?.id : undefined,
      targetQueueName:
        targetType === "queue" ? queue.selected?.name : undefined,
      // For skills tab, merge the skills note into the reason field
      reason:
        targetType === "skills"
          ? `Skills-based routing issue. ${skillsNote}`.trim()
          : reason || undefined,
    });
  }

  // Submit button is only enabled once a valid selection is made
  const canSubmit =
    (targetType === "agent" && !!agent.selected) ||
    (targetType === "queue" && !!queue.selected) ||
    targetType === "skills";

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mt-4">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
        Where should it have routed?
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Select how it should have been routed, then we'll suggest a
        configuration fix.
      </p>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tab selector: Specific Agent | Specific Queue | Skills-based */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Intended routing target
          </label>
          <div className="flex gap-2">
            {/* Skills tab only shown when org has skills configured */}
            {(
              [
                "agent",
                "queue",
                ...(skillsEnabled ? ["skills"] : []),
              ] as TargetType[]
            ).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeChange(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  targetType === type
                    ? "bg-brand-500 text-white border-brand-500"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
                }`}
              >
                {type === "agent"
                  ? "Specific Agent"
                  : type === "queue"
                    ? "Specific Queue"
                    : "Skills-based"}
              </button>
            ))}
          </div>
        </div>

        {/* Agent typeahead — shown when "Specific Agent" is selected */}
        {targetType === "agent" && (
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Target Agent
            </label>
            <input
              type="text"
              placeholder="Search agents…"
              value={agent.query}
              onChange={(e) => agent.setQuery(e.target.value)}
              onFocus={() => agent.results.length > 0 && agent.setOpen(true)}
              autoFocus
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
            {agent.open && agent.results.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-auto">
                {agent.results.map((a) => (
                  // onMouseDown fires before onBlur so the click registers before the dropdown closes
                  <li
                    key={a.id}
                    onMouseDown={() => agent.choose(a)}
                    className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 cursor-pointer"
                  >
                    {a.name}
                  </li>
                ))}
              </ul>
            )}
            {agent.selected && (
              <button
                type="button"
                onClick={agent.clear}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Queue typeahead — shown when "Specific Queue" is selected */}
        {targetType === "queue" && (
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Target Queue
            </label>
            <input
              type="text"
              placeholder="Search queues…"
              value={queue.query}
              onChange={(e) => queue.setQuery(e.target.value)}
              onFocus={() => queue.results.length > 0 && queue.setOpen(true)}
              autoFocus
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
            {queue.open && queue.results.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-auto">
                {queue.results.map((q) => (
                  <li
                    key={q.id}
                    onMouseDown={() => queue.choose(q)}
                    className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 cursor-pointer"
                  >
                    {q.name}
                  </li>
                ))}
              </ul>
            )}
            {queue.selected && (
              <button
                type="button"
                onClick={queue.clear}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Skills note — shown when "Skills-based" is selected */}
        {targetType === "skills" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Which skill(s) should have matched?{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Spanish, Billing Tier 2"
              value={skillsNote}
              onChange={(e) => setSkillsNote(e.target.value)}
              autoFocus
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
        )}

        {/* Reason field — shown for all target types once one is selected */}
        {targetType && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Why should it have routed there?{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. The agent has the required skill, or this queue handles escalations"
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none placeholder-slate-400 dark:placeholder-slate-500"
            />
            {/* Explicit privacy reminder on the reason field */}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Do not include customer names or case details.
            </p>
          </div>
        )}

        {targetType && (
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {loading
              ? "Generating suggestion…"
              : "Generate Configuration Suggestion"}
          </button>
        )}
      </form>
    </div>
  );
}

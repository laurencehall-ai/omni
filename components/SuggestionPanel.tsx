// ─── SuggestionPanel ──────────────────────────────────────────────────────────
// Displays the configuration suggestion produced by /api/suggest.
// Shows the likely cause, a list of specific changes to make in Salesforce Setup,
// an optional Omni-Channel Flow note, and a confidence badge.

import { ConfigSuggestion } from "@/lib/types";

// Maps confidence level to a colored badge style.
const CONFIDENCE_STYLES = {
  High:   "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
  Low:    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

export default function SuggestionPanel({ suggestion }: { suggestion: ConfigSuggestion }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mt-4 space-y-5">

      {/* Header: title + confidence badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Configuration Suggestion</h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CONFIDENCE_STYLES[suggestion.confidence]}`}>
          {suggestion.confidence} confidence
        </span>
      </div>

      {/* Likely cause — one-paragraph plain-English explanation */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Likely Cause</p>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{suggestion.likelyCause}</p>
      </div>

      {/* Suggested changes — each as a card with current → suggested value */}
      {suggestion.suggestedChanges.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">Suggested Changes</p>
          <div className="space-y-3">
            {suggestion.suggestedChanges.map((change, i) => (
              <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                {/* Area badge — e.g. "Queue Membership", "Skill Requirements" */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded">{change.area}</span>
                </div>
                {/* Current value → suggested value, strikethrough on current */}
                <div className="flex items-center gap-3 text-sm mb-2">
                  <span className="text-slate-500 dark:text-slate-500 line-through">{change.currentValue}</span>
                  <span className="text-slate-300 dark:text-slate-600">→</span>
                  <span className="text-slate-900 dark:text-white font-medium">{change.suggestedValue}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{change.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flow note — shown when an Omni-Channel Flow may be overriding queue routing */}
      {suggestion.flowNote && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Omni-Channel Flow</p>
          <p className="text-sm text-blue-700 dark:text-blue-300">{suggestion.flowNote}</p>
        </div>
      )}
    </div>
  );
}

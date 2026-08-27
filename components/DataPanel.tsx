import { RoutingTrace, RoutingExplanation } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/utils";

export default function DataPanel({ trace, explanation }: { trace: RoutingTrace; explanation: RoutingExplanation }) {
  const rows: [string, string][] = [
    ["Work Item Type", trace.workItemType],
    ["Channel", trace.channelLabel],
    ["Queue", trace.queueName],
    ["Agent", `${trace.agentName} (${trace.agentUsername})`],
    ["Routing Model", trace.routingModel],
    ["Status", trace.status],
    ["Routing Config", trace.routingConfigName ?? "—"],
    ["Routing Priority", trace.routingConfigPriority != null ? String(trace.routingConfigPriority) : "—"],
    ["Capacity Weight", trace.capacityWeight != null ? String(trace.capacityWeight) : "—"],
    ["Capacity %", trace.capacityPercentage != null ? `${trace.capacityPercentage}%` : "—"],
    ["Created", formatDate(trace.createdDate)],
    ["Accepted", trace.acceptDateTime ? formatDate(trace.acceptDateTime) : "—"],
    ["Time to Accept", trace.timeToAcceptSeconds != null ? formatDuration(trace.timeToAcceptSeconds) : "—"],
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">Raw Routing Data</h3>

      <table className="w-full text-sm mb-4">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 pr-4 text-slate-500 font-medium w-48">{label}</td>
              <td className="py-1.5 text-slate-900">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {trace.requiredSkills.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-500 mb-1">Required Skills</p>
          <div className="flex flex-wrap gap-1">
            {trace.requiredSkills.map((s) => (
              <span key={s.skillName} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                {s.skillName}{s.skillLevel ? ` (L${s.skillLevel})` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {trace.agentSkills.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Agent Skills</p>
          <div className="flex flex-wrap gap-1">
            {trace.agentSkills.map((s) => (
              <span key={s.skillName} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {s.skillName}{s.skillLevel ? ` (L${s.skillLevel})` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {explanation.skillsExplanation && (
        <p className="text-xs text-slate-500 mt-3">{explanation.skillsExplanation}</p>
      )}
    </div>
  );
}

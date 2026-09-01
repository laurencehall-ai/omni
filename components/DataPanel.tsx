// ─── DataPanel ────────────────────────────────────────────────────────────────
// Displays the raw routing data table on the trace page.
// Shows all fields from the RoutingTrace plus customer info.
//
// Customer data is displayed here (in the admin's browser) but is never
// forwarded to Claude or any external API — that enforcement is in data-guard.ts.

import { RoutingTrace, RoutingExplanation } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/utils";

// Opens the Salesforce record in a new tab using the org's instance URL.
function SfLink({
  instanceUrl,
  id,
  label,
}: {
  instanceUrl: string;
  id: string;
  label: string;
}) {
  return (
    <a
      href={`${instanceUrl}/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-500 dark:text-brand-400 hover:underline font-medium"
    >
      {label} ↗
    </a>
  );
}

export default function DataPanel({
  trace,
  explanation,
}: {
  trace: RoutingTrace;
  explanation: RoutingExplanation;
}) {
  const { customer, instanceUrl } = trace;

  // Build the table rows in display order.
  // Customer rows are prepended at the top using unshift/splice after building the base list.
  const rows: [string, React.ReactNode][] = [
    ["Work Item Type", trace.workItemType],
    ["Channel", trace.channelLabel],
    ["Queue", trace.queueName],
    ["Agent", `${trace.agentName} (${trace.agentUsername})`],
    ["Routing Type", trace.routingType ?? trace.routingModel],
    ["Status", trace.status],
    ["Routing Config", trace.routingConfigName ?? "—"],
    [
      "Routing Priority",
      trace.routingConfigPriority != null
        ? String(trace.routingConfigPriority)
        : "—",
    ],
    [
      "Capacity Weight",
      trace.capacityWeight != null ? String(trace.capacityWeight) : "—",
    ],
    [
      "Capacity %",
      trace.capacityPercentage != null ? `${trace.capacityPercentage}%` : "—",
    ],
    ["Created", formatDate(trace.createdDate)],
    ["Accepted", trace.acceptDateTime ? formatDate(trace.acceptDateTime) : "—"],
    [
      "Time to Accept",
      trace.timeToAcceptSeconds != null
        ? formatDuration(trace.timeToAcceptSeconds)
        : "—",
    ],
  ];

  // Always show a link to the underlying SF record — regardless of whether
  // customer enrichment succeeded. sfWorkItemId is the actual Case/VoiceCall/
  // MessagingSession ID from AgentWork.WorkItemId (not the AgentWork ID itself).
  const isVoiceCall = trace.workItemType === "Voice Call";
  const isMessaging = trace.workItemType === "Messaging Session";

  if (customer?.caseNumber && customer?.caseId) {
    // Case with a readable number — show it prominently
    rows.unshift([
      "Case",
      <SfLink
        key="case"
        instanceUrl={instanceUrl}
        id={customer.caseId}
        label={`Case ${customer.caseNumber}`}
      />,
    ]);
  } else if (isVoiceCall) {
    rows.unshift([
      "Voice Call",
      <SfLink
        key="vc"
        instanceUrl={instanceUrl}
        id={trace.sfWorkItemId}
        label="View Voice Call"
      />,
    ]);
  } else if (isMessaging) {
    rows.unshift([
      "Messaging Session",
      <SfLink
        key="ms"
        instanceUrl={instanceUrl}
        id={trace.sfWorkItemId}
        label="View Messaging Session"
      />,
    ]);
  } else {
    // Any other work item type (Agentforce, Live Chat, custom, etc.)
    rows.unshift([
      "Work Item",
      <SfLink
        key="wi"
        instanceUrl={instanceUrl}
        id={trace.sfWorkItemId}
        label={`View ${trace.workItemType}`}
      />,
    ]);
  }

  // Enrichment rows — only when customer lookup succeeded
  if (customer) {
    const contactRowLabel = isMessaging ? "Messaging End User" : "Contact";
    if (customer.contactName && customer.contactId) {
      rows.splice(1, 0, [
        contactRowLabel,
        <SfLink
          key="contact"
          instanceUrl={instanceUrl}
          id={customer.contactId}
          label={customer.contactName}
        />,
      ]);
    } else if (customer.contactName) {
      rows.splice(1, 0, [contactRowLabel, customer.contactName]);
    }
    if (customer.phone) {
      rows.splice(customer.contactName ? 2 : 1, 0, ["Phone", customer.phone]);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-4">
        Raw Routing Data
      </h3>

      {/* Two-column table: field name on the left, value on the right */}
      <table className="w-full text-sm mb-4">
        <tbody>
          {rows.map(([label, value]) => (
            <tr
              key={String(label)}
              className="border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              <td className="py-1.5 pr-4 text-slate-500 dark:text-slate-400 font-medium w-48">
                {label}
              </td>
              <td className="py-1.5 text-slate-900 dark:text-slate-200">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Required skills — shown as pill badges when the routing config had skill requirements */}
      {trace.requiredSkills.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Required Skills
          </p>
          <div className="flex flex-wrap gap-1">
            {trace.requiredSkills.map((s) => (
              <span
                key={s.skillName}
                className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full"
              >
                {s.skillName}
                {s.skillLevel ? ` (L${s.skillLevel})` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agent skills at time of routing — from AgentWorkSkill records */}
      {trace.agentSkills.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Agent Skills
          </p>
          <div className="flex flex-wrap gap-1">
            {trace.agentSkills.map((s) => (
              <span
                key={s.skillName}
                className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full"
              >
                {s.skillName}
                {s.skillLevel ? ` (L${s.skillLevel})` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Inline skills explanation from the routing analyzer */}
      {explanation.skillsExplanation && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
          {explanation.skillsExplanation}
        </p>
      )}
    </div>
  );
}

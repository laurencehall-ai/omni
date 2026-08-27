export default function DataPrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-4">

      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Data &amp; Privacy</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">How RouteCause handles your Salesforce data</p>
      </div>

      {/* TL;DR callout */}
      <div className="bg-white dark:bg-slate-900 border-2 border-brand-500 dark:border-brand-500 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-brand-500 rounded-full" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">The Short Version</p>
        </div>
        <p className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
          Customer data never leaves your Salesforce org.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
          Data is displayed in your browser session — the same as any Salesforce list view — but is never sent to any AI model or third-party service. Only routing infrastructure metadata and agent names are shared with the AI to generate explanations.
        </p>
      </div>

      <div className="space-y-6">

        {/* Section 1 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono mb-4">How the connection works</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
            RouteCause connects to your Salesforce org using OAuth 2.0 — the same standard your org uses for all connected apps. You authenticate directly with Salesforce; RouteCause never sees your Salesforce password.
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            Your access token is stored in an encrypted, server-side session cookie and used only to query the Salesforce REST API on your behalf. It is never logged or stored in a database.
          </p>
        </section>

        {/* Section 2 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono mb-4">What data is queried from Salesforce</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            RouteCause queries only the <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">AgentWork</span> and <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">AgentWorkSkill</span> objects — Salesforce's internal routing event records. These contain routing infrastructure data, not customer content.
          </p>
          <div className="space-y-3">
            {[
              { label: "Routing metadata", examples: "Channel, queue, routing model, routing type, capacity weight, priority, status", safe: true },
              { label: "Timing data", examples: "Work item created date, accept date/time, speed to answer", safe: true },
              { label: "Agent information", examples: "Assigned agent name and username, skills matched", safe: true },
              { label: "Work item reference ID", examples: "The Salesforce record ID of the underlying Case, Messaging Session, or Voice Call — used only to identify the type of item, never to fetch the record itself", safe: true },
            ].map((row) => (
              <div key={row.label} className="flex items-start gap-3 text-sm">
                <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{row.label}</span>
                  <span className="text-slate-500 dark:text-slate-400"> — {row.examples}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            {[
              { label: "Case subject or description", note: "Not queried" },
              { label: "Contact or customer name", note: "Not queried" },
              { label: "Chat or messaging transcript", note: "Not queried" },
              { label: "Phone number", note: "Not queried" },
              { label: "Any custom object data", note: "Not queried" },
            ].map((row) => (
              <div key={row.label} className="flex items-start gap-3 text-sm">
                <span className="text-slate-300 dark:text-slate-600 mt-0.5 shrink-0">✗</span>
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{row.label}</span>
                  <span className="text-slate-400 dark:text-slate-500"> — {row.note}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono mb-4">Two separate privacy boundaries</h2>

          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Boundary 1: Your browser (within your org)</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-4">
                The work items list displays routing data in your browser session. This is equivalent to viewing a Salesforce list view or report — the data travels from Salesforce to your authenticated browser session and nowhere else. The admin using RouteCause sees the same data they would already have access to in Salesforce.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Boundary 2: The AI model (strict — routing metadata only)</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-4 mb-3">
                When RouteCause generates a routing explanation or configuration suggestion, it passes a filtered payload to an AI model (Claude by Anthropic). Before any data is sent, a data guard layer strips the payload to only routing infrastructure fields. Specifically:
              </p>
              <ul className="pl-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2"><span className="text-green-500 shrink-0">✓</span> Sent to AI: channel name, queue name, routing model, skills, capacity weight, agent name, timing</li>
                <li className="flex items-start gap-2"><span className="text-red-400 shrink-0">✗</span> Never sent to AI: work item ID, any customer-facing record data</li>
              </ul>
              <p className="text-sm text-slate-500 dark:text-slate-500 leading-relaxed pl-4 mt-3">
                The AI cannot identify or reference any customer from the data it receives. It sees only the routing plumbing — the same information a Salesforce admin would look at in the Omni-Channel Supervisor tab.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono mb-4">What RouteCause does not do</h2>
          <ul className="space-y-2.5">
            {[
              "Store any Salesforce data in a database or log file",
              "Share data with any third party other than the AI model (and only routing metadata to that)",
              "Retain routing data between sessions",
              "Train or fine-tune any AI model on your data",
              "Access any Salesforce object beyond AgentWork and AgentWorkSkill",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <span className="text-slate-300 dark:text-slate-600 shrink-0 mt-0.5">—</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Section 5 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono mb-4">Who should use this tool</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            RouteCause is intended for Salesforce administrators and routing configuration owners. It is not a customer-facing tool. The person running RouteCause should already have Salesforce admin or service cloud user access — the tool does not grant any additional data permissions beyond what their Salesforce profile already allows.
          </p>
        </section>

        {/* Section 6 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono mb-4">AI model provider</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
            Routing explanations and configuration suggestions are generated by <strong className="text-slate-900 dark:text-white">Claude</strong>, made by Anthropic. Only the filtered routing metadata payload described above is sent. Anthropic's data usage policies apply to that payload.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            If no AI API key is configured, RouteCause falls back to a fully deterministic, local explanation engine — no data leaves the app server at all.
          </p>
        </section>

      </div>

      <p className="text-xs text-slate-400 dark:text-slate-600 text-center mt-8 font-mono">
        RouteCause v1 · Built for Salesforce admins
      </p>
    </div>
  );
}

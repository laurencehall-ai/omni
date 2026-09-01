export default function DataPrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
          Data &amp; Privacy
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          How RouteCause handles your Salesforce data — honestly.
        </p>
      </div>

      {/* TL;DR callout */}
      <div className="bg-white dark:bg-slate-900 border-2 border-brand-500 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-brand-500 rounded-full" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
            The Short Version
          </p>
        </div>
        <p className="text-lg font-bold text-slate-900 dark:text-white leading-snug mb-2">
          Customer data stays in your browser. It never reaches any AI or third
          party.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          RouteCause displays customer identifiers (case numbers, phone numbers,
          contact names) in your browser session so you can find the right work
          item — the same way a Salesforce list view does. Before
          anything is sent to the AI, a strict filter removes all of it. The AI
          only ever sees routing plumbing: channels, queues, models, skills, and
          agent names.
        </p>
      </div>

      <div className="space-y-6">
        {/* What's displayed in your browser */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-brand-500 rounded-full" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
              What's displayed in your browser
            </h2>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            To help you find a specific work item, RouteCause queries the
            underlying Salesforce record and shows a limited identifier. This
            data is displayed in your authenticated browser session only — it
            travels from Salesforce to your browser, the same as any Salesforce
            list view or report.
          </p>
          <div className="space-y-2.5">
            {[
              {
                type: "Case",
                field: "CaseNumber + Contact Name",
                example: "Case 00012345 · Jane Smith",
              },
              {
                type: "Voice Call",
                field: "From phone number (full)",
                example: "Call from +14155551234",
              },
              {
                type: "Messaging Session",
                field: "Messaging end user name/handle",
                example: "John Doe",
              },
              {
                type: "All types",
                field: "Routing metadata + agent info",
                example: "Queue, model, skills, timing",
              },
            ].map((row) => (
              <div key={row.type} className="flex items-start gap-3 text-sm">
                <span className="text-brand-500 dark:text-brand-400 shrink-0 mt-0.5">
                  →
                </span>
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {row.type}:
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {" "}
                    {row.field}{" "}
                  </span>
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                    e.g. {row.example}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
            The admin using RouteCause must already have Salesforce access to
            these objects. RouteCause does not grant any additional data
            permissions beyond what their Salesforce profile allows.
          </p>
        </section>

        {/* What the AI sees */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-amber-500 rounded-full" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
              What the AI sees
            </h2>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            When generating a routing explanation or configuration suggestion,
            RouteCause sends a filtered payload to Claude (by Anthropic). A data
            guard layer strips the payload before it leaves the app server. The
            AI cannot identify or reference any customer from the data it
            receives.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-2">
                Sent to AI
              </p>
              <ul className="space-y-1 text-xs text-green-700 dark:text-green-400">
                <li>✓ Channel name</li>
                <li>✓ Queue name</li>
                <li>✓ Routing model &amp; type</li>
                <li>✓ Skills matched</li>
                <li>✓ Capacity weight</li>
                <li>✓ Agent name</li>
                <li>✓ Time to accept</li>
              </ul>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide mb-2">
                Never sent to AI
              </p>
              <ul className="space-y-1 text-xs text-red-700 dark:text-red-400">
                <li>✗ Customer name</li>
                <li>✗ Phone number</li>
                <li>✗ Case subject or description</li>
                <li>✗ Chat or message content</li>
                <li>✗ Work item ID</li>
                <li>✗ Any contact or account data</li>
              </ul>
            </div>
          </div>
        </section>

        {/* What RouteCause doesn't do */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-slate-400 rounded-full" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
              What RouteCause does not do
            </h2>
          </div>
          <ul className="space-y-2.5">
            {[
              "Store any Salesforce data in a database or log file",
              "Retain data between sessions — closing the browser clears everything",
              "Share data with any third party other than the AI model (routing metadata only)",
              "Train or fine-tune any AI model on your data",
              "Access any Salesforce object beyond what's described above",
              "Push any changes back to your Salesforce org",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300"
              >
                <span className="text-slate-300 dark:text-slate-600 shrink-0 mt-0.5">
                  —
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Connection & auth */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-brand-500 rounded-full" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
              Connection &amp; authentication
            </h2>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            RouteCause connects via Salesforce OAuth 2.0. You authenticate
            directly with Salesforce — RouteCause never sees your password. Your
            access token is stored in an encrypted, server-side session cookie
            for the duration of your session and is never logged or persisted to
            a database.
          </p>
        </section>

        {/* AI provider */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-brand-500 rounded-full" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
              AI model provider
            </h2>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
            Routing explanations and configuration suggestions are generated by{" "}
            <strong className="text-slate-900 dark:text-white">Claude</strong>{" "}
            by Anthropic. Only the filtered routing metadata payload described
            above is transmitted. Anthropic's data usage policies apply to that
            payload.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            If no AI API key is configured, RouteCause falls back to a fully
            local, deterministic explanation engine — no data leaves the app
            server at all.
          </p>
        </section>
      </div>
    </div>
  );
}

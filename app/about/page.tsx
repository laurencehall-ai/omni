export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto py-4 space-y-10">

      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">About RouteCause</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Everything you need to know about what it does, how to connect it, and how to use it.
        </p>
      </div>

      {/* What it does */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-brand-500 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">What RouteCause does</h2>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          RouteCause connects to your Salesforce org and helps you understand <strong className="text-slate-900 dark:text-white">why a work item routed the way it did</strong>. When a case, call, or chat lands with the wrong agent — or doesn't route at all — RouteCause shows you the exact path it took through your Omni-Channel configuration so you can find the break.
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          It queries your <strong className="text-slate-900 dark:text-white">AgentWork records</strong> — the raw log Salesforce keeps of every routing decision — and combines them with queue, channel, skill, and agent data to build a human-readable trace. An AI narration (powered by Claude) explains the decision in plain English. A deterministic fallback engine works even without an AI key.
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          If something looks wrong, you can flag the item, describe what <em>should</em> have happened, and get a concrete suggestion for which Salesforce configuration setting to change.
        </p>
      </section>

      {/* Setup */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-brand-500 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">How to connect your org</h2>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          RouteCause connects via <strong className="text-slate-900 dark:text-white">Salesforce OAuth 2.0</strong>. You never enter your password into RouteCause — you authenticate directly with Salesforce, which issues a short-lived access token. That token is stored in an encrypted session cookie and used only to query routing data on your behalf.
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          To enable this, a Salesforce admin must create a <strong className="text-slate-900 dark:text-white">Connected App</strong> in your org. A Connected App is a Salesforce configuration record that authorizes an external application to connect using OAuth. Think of it as registering RouteCause as a trusted caller.
        </p>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide font-mono mb-3">Steps to create the Connected App</p>
          {[
            'In Salesforce Setup, search for "App Manager" and click New Connected App.',
            'Give it a name (e.g. "RouteCause") and enter a contact email.',
            'Check "Enable OAuth Settings".',
            "Set the Callback URL to your RouteCause instance URL + /api/auth/callback (e.g. http://localhost:3000/api/auth/callback for local dev).",
            'Under OAuth Scopes, add: "Access and manage your data (api)", "Perform requests at any time (refresh_token, offline_access)".',
            "Save, then copy the Consumer Key (Client ID) and Consumer Secret into your .env.local as SF_CLIENT_ID and SF_CLIENT_SECRET.",
            "Wait 2-10 minutes for the Connected App to propagate in Salesforce, then click Connect in RouteCause.",
          ].map((step, i) => (
            <div key={i} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300">
              <span className="shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          The user connecting RouteCause must have read access to AgentWork, ServiceChannel, Group (Queue), User, Skill, AgentWorkSkill, and optionally Case, VoiceCall, and MessagingSession for customer identifier lookup.
        </p>
      </section>

      {/* How to use */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-brand-500 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">How to use it</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: "Find the work item", body: "The Work Items list shows recent Omni-Channel activity. Search by customer name, phone, case number, channel, queue, agent, or status. Use the time range selector to look back up to 30 days." },
            { label: "Trace the route", body: "Click any work item to open its trace. You'll see an executive summary, a plain-English narration of the routing decision, the raw Salesforce data, and an interactive routing map showing the path the item took." },
            { label: "Validate or flag", body: "At the bottom of the trace, indicate whether the routing was correct (👍) or wrong (👎). Validated items show a green badge in the list; flagged items show a red badge so you can track misroutes at a glance." },
            { label: "Get a fix suggestion", body: "If you flag an item, describe who it should have gone to and why. RouteCause will suggest which Salesforce configuration setting to change — queue membership, skill requirements, capacity weight, or routing model." },
          ].map(({ label, body }) => (
            <div key={label} className="flex gap-3 text-sm">
              <span className="text-brand-500 dark:text-brand-400 shrink-0 mt-0.5">→</span>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{label}: </span>
                <span className="text-slate-600 dark:text-slate-400">{body}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Beta features */}
      <section className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700/50 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-amber-500 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">Beta features</h2>
          <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 px-1.5 py-0.5 rounded font-mono uppercase tracking-wide">beta</span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          These features are functional but rely on data that is partially available via the Salesforce REST API. They will improve as more data sources become accessible.
        </p>

        <div className="space-y-4">
          <div className="border-l-2 border-amber-400 pl-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">RouteMap</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              An org-wide overview of how your Omni-Channel configuration is connected to your service organization — channels, queues, and agents. RouteMap pulls your Service Channel definitions and shows what routing infrastructure is active in your org. Future versions will draw the full graph: which channels feed which queues, which queues use which routing configurations, and which agents are eligible to receive work from each queue.
            </p>
          </div>

          <div className="border-l-2 border-amber-400 pl-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Routing Map (on trace page)</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              A visual diagram — shown on every trace — of how your Salesforce configuration influenced where the work item ended up. It shows the channel it entered on, the queue it waited in, the routing model that selected the agent, and any skills that were evaluated. Tap any station on the map for details. This is beta because the routing model and skill data available via AgentWork may not capture every edge case in complex flow-based routing.
            </p>
          </div>
        </div>
      </section>


    </div>
  );
}

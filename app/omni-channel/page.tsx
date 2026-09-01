export default function OmniChannelPage() {
  return (
    <div className="max-w-3xl mx-auto py-4 space-y-10">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
          Salesforce Omni-Channel
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          A practical reference for admins setting up or troubleshooting
          Omni-Channel routing.
        </p>
      </div>

      {/* What is it */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-brand-500 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
            What is Omni-Channel?
          </h2>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          Omni-Channel is Salesforce's built-in work routing engine. It
          automatically pushes work — cases, chats, calls, leads, or any custom
          object — to the right available agent without anyone having to
          manually assign or claim it. The admin configures the rules;
          Salesforce handles the dispatching in real time.
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          It integrates with Service Cloud, Sales Cloud, and Field Service, and
          supports both simple queue-based routing and complex skills-based or
          flow-driven logic.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          {[
            {
              label: "Omni-Channel Overview",
              url: "https://help.salesforce.com/s/articleView?id=sf.omnichannel_intro.htm",
              live: true,
            },
            {
              label: "Skills-Based Routing",
              url: "https://help.salesforce.com/s/articleView?id=sf.omnichannel_skills_based_routing.htm",
              live: true,
            },
            { label: "Set Up Omni-Channel", url: null, live: false },
            { label: "Routing Configurations", url: null, live: false },
            { label: "Omni-Channel Flow", url: null, live: false },
          ].map(({ label, url, live }) =>
            live && url ? (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 bg-brand-50 dark:bg-brand-700/20 hover:bg-brand-100 dark:hover:bg-brand-700/30 px-3 py-1.5 rounded-lg transition-colors font-mono"
              >
                {label} ↗
              </a>
            ) : (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-600 border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg font-mono cursor-not-allowed"
                title="Link URL needed — verify on help.salesforce.com"
              >
                {label} …
              </span>
            ),
          )}
        </div>
      </section>

      {/* Mental model */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-brand-500 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
            The Mental Model
          </h2>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          Think of Omni-Channel as a{" "}
          <strong className="text-slate-900 dark:text-white">
            smart dispatcher
          </strong>
          : work comes in through a channel (case, chat, call, etc.), gets
          evaluated, and is pushed automatically to the right available agent —
          no one has to go hunting for work or wait in a black box.
        </p>
      </section>

      {/* Core building blocks */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-brand-500 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
            Core Building Blocks
          </h2>
        </div>
        {[
          {
            term: "Service Channel",
            def: "The entry point for a type of work. Maps a Salesforce object (Case, VoiceCall, etc.) to Omni-Channel so items of that type can be routed.",
          },
          {
            term: "Queue",
            def: "A holding line for work of a given type. Work waits here until an eligible, available agent can take it.",
          },
          {
            term: "Skill",
            def: "An attribute tagged to an agent — not to a queue. Used in skills-based routing to match work to agents with the right expertise.",
          },
          {
            term: "Routing Configuration",
            def: "The rules for who gets the work. Controls the routing model (Most Available vs. Least Active agent) and capacity weighting.",
          },
          {
            term: "Omni-Channel Flow",
            def: "The decision logic that evaluates each work item and routes it. The most flexible routing option and requires no custom code.",
          },
        ].map(({ term, def }) => (
          <div key={term} className="flex gap-3 text-sm">
            <span className="text-brand-500 dark:text-brand-400 shrink-0 mt-0.5">
              →
            </span>
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {term}:{" "}
              </span>
              <span className="text-slate-600 dark:text-slate-400">{def}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Best practices */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-emerald-500 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
            Best Practices
          </h2>
        </div>

        {[
          {
            title: "Queues vs. Skills",
            items: [
              "Default to queue-based routing — it's simpler and covers most needs.",
              "Reach for skills-based routing only when routing truly depends on agent attributes like language, certification, or product expertise — not just team or topic.",
              "If you're coming from another platform: what other systems call a \"skill group\" usually maps to a Salesforce Queue, not a Skill. Worth clarifying early so the terminology doesn't cause confusion.",
            ],
          },
          {
            title: "Out-of-the-Box vs. Flows",
            items: [
              "Use Omni-Channel Flows as the default for routing logic — most flexible, no code required.",
              "Simple out-of-the-box settings (route to a queue, most-available agent) are fine when your logic genuinely is that simple.",
              "Keep routing decisions and side effects separate — one flow decides where work goes, separate automation handles anything else.",
            ],
          },
          {
            title: "Single vs. Multiple Routing Engines",
            items: [
              "A single consolidated routing engine is strongly preferable to running two side by side. Split/blended setups add real ongoing complexity keeping agent status and capacity in sync.",
              "If an external engine must stay in the mix, plan explicitly for how routing events will be exchanged — event-driven integration rather than polling.",
            ],
          },
          {
            title: "Platform Choice",
            items: [
              "Use Enhanced Omni-Channel (SCRT2) rather than the standard/legacy version. It's event-driven, faster, more reliable, and is the actively supported path forward.",
            ],
          },
        ].map(({ title, items }) => (
          <div key={title}>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
              {title}
            </h3>
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Bottom line */}
      <section className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-emerald-500 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-mono">
            Bottom Line
          </h2>
        </div>
        <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
          Start simple (queues + most-available-agent), use Flows for decision
          logic, and consolidate onto a single routing engine wherever possible
          — this keeps day-to-day admin overhead low and keeps you ready for
          future capabilities like AI-assisted routing.
        </p>
      </section>
    </div>
  );
}

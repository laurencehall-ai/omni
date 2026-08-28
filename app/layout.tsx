import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "RouteCause",
  description: "Salesforce Omni-Channel routing explainer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var saved = localStorage.getItem('rc-theme');
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if(saved === 'dark' || (!saved && prefersDark)) document.documentElement.classList.add('dark');
          })();
        `}} />
      </head>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-brand-700 to-slate-900 shadow-lg">
          <div className="px-6 py-3 flex items-center justify-between">
            <a href="/work-items" className="flex items-center gap-3 group">
              {/* Road sign: keep-right arrow navigating around a road island */}
              <svg width="44" height="46" viewBox="0 0 44 46" fill="none" xmlns="http://www.w3.org/2000/svg"
                className="shrink-0 opacity-85 group-hover:opacity-100 transition-opacity">
                {/* Sign post */}
                <rect x="18.5" y="41" width="7" height="5" rx="1.5" fill="white" fillOpacity="0.25"/>
                {/* Sign background — highway green */}
                <rect x="0.5" y="0.5" width="43" height="39" rx="4.5" fill="#166534"/>
                {/* Inner border */}
                <rect x="3" y="3" width="38" height="34" rx="2.5" fill="none" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
                {/* Road island — white pill, offset left */}
                <rect x="12" y="8" width="8" height="23" rx="4" fill="white" fillOpacity="0.9"/>
                {/* Arrow enters bottom-center, sweeps right of island, exits top pointing up */}
                <path d="M 17 37 C 17 30 35 25 35 19 C 35 13 27 10 27 4"
                  stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                {/* Arrowhead at top — tangent at endpoint is straight up */}
                <path d="M 23 8 L 27 4 L 31 8"
                  stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-white font-black text-xl tracking-tight group-hover:text-brand-300 transition-colors">RouteCause</span>
                  <span className="text-brand-300 text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded leading-none">v1</span>
                </div>
                <p className="text-white/50 text-[10px] font-mono uppercase tracking-widest leading-none mt-0.5">
                  Omni‑Channel Routing Intelligence
                </p>
              </div>
            </a>
            <div className="flex items-center gap-4">
              <nav className="flex items-center gap-5">
                <a href="/synopsis" className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors">
                  RouteMap
                  <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-px rounded tracking-wide">beta</span>
                </a>

              </nav>
              <div className="hidden sm:flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/70 text-xs font-mono">Live</span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="px-6 py-8">{children}</main>
        <footer className="border-t border-slate-200 dark:border-slate-800 mt-8">
          <div className="px-6 py-4 flex items-center justify-between">
            <p className="text-xs text-slate-400 dark:text-slate-600 font-mono">RouteCause v1</p>
            <div className="flex items-center gap-4">
              <a href="/about" className="text-xs text-slate-400 dark:text-slate-600 hover:text-brand-500 dark:hover:text-brand-400 font-mono underline-offset-2 hover:underline">About</a>
              <a href="/omni-channel" className="text-xs text-slate-400 dark:text-slate-600 hover:text-brand-500 dark:hover:text-brand-400 font-mono underline-offset-2 hover:underline">Omni‑Channel</a>
              <a href="/made-with" className="text-xs text-slate-400 dark:text-slate-600 hover:text-brand-500 dark:hover:text-brand-400 font-mono underline-offset-2 hover:underline">Made With SF + Claude</a>
              <a href="/data-privacy" className="text-xs text-slate-400 dark:text-slate-600 hover:text-brand-500 dark:hover:text-brand-400 font-mono underline-offset-2 hover:underline">Data &amp; Privacy</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

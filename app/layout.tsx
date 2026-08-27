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
      <body className="bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-brand-700 to-slate-900 shadow-lg">
          <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
            <a href="/work-items" className="flex items-center gap-3 group">
              {/* Logo mark */}
              <div className="relative w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shadow-inner border border-white/20 group-hover:bg-white/25 transition-colors">
                <span className="text-white text-sm font-black tracking-tighter">RC</span>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-black text-xl tracking-tight group-hover:text-brand-300 transition-colors">RouteCause</span>
                  <span className="text-brand-300 text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded">v1</span>
                </div>
                <p className="text-white/50 text-[10px] font-mono uppercase tracking-widest leading-none">
                  Omni‑Channel Routing Intelligence
                </p>
              </div>
            </a>
            <div className="flex items-center gap-4">
              <nav>
                <a href="/synopsis" className="text-white/60 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors">Synopsis</a>
              </nav>
              <div className="hidden sm:flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/70 text-xs font-mono">Live</span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="border-t border-slate-200 dark:border-slate-800 mt-8">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <p className="text-xs text-slate-400 dark:text-slate-600 font-mono">RouteCause v1 · For Salesforce admins</p>
            <a href="/data-privacy"
              className="text-xs text-slate-400 dark:text-slate-600 hover:text-brand-500 dark:hover:text-brand-400 font-mono underline-offset-2 hover:underline">
              Data &amp; Privacy
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}

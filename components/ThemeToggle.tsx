"use client";

// ─── ThemeToggle ──────────────────────────────────────────────────────────────
// Sun/moon button in the header that toggles dark mode.
//
// Why read the DOM class instead of React state?
// The layout's inline <script> applies the saved theme before React hydrates.
// If we track dark mode only in useState, the button's internal state
// gets out of sync with the actual <html> class on first render.
// Reading document.documentElement.classList directly is the source of truth.

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  // Avoid hydration mismatch: render an invisible placeholder until the
  // component mounts and we can read the real DOM state.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Read saved preference; fall back to OS preference if none stored
    const saved = localStorage.getItem("rc-theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    // Read current DOM state — this is authoritative, not React state
    const next = !document.documentElement.classList.contains("dark");
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("rc-theme", next ? "dark" : "light");
  }

  // Hold the button's space during SSR to prevent layout shift
  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors hover:bg-white/10"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}

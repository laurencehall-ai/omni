"use client";

// ─── useTheme hook ────────────────────────────────────────────────────────────
// Returns whether dark mode is currently active, and updates in real time
// when the toggle is clicked.
//
// Why a MutationObserver instead of reading localStorage?
// The ThemeToggle component applies the "dark" class directly to <html>.
// SVG elements inside components can't use Tailwind dark: classes,
// so they need to know the current theme as a JavaScript value.
// The MutationObserver watches the <html> class attribute and fires
// immediately whenever the toggle changes it — no polling needed.

import { useState, useEffect } from "react";

export function useTheme(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Read the current state on mount
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();

    // Watch for any future changes to the class attribute on <html>
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Clean up the observer when the component unmounts
    return () => observer.disconnect();
  }, []);

  return isDark;
}

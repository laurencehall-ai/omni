// ─── Shared utility functions ─────────────────────────────────────────────────

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merges Tailwind CSS class names, resolving conflicts.
// Used throughout components to conditionally combine class strings.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formats an ISO timestamp into a human-readable local date/time string.
// Used in work items list and trace page headers.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// Formats a duration in seconds into a compact human-readable string.
// e.g. 90 → "1m 30s", 120 → "2m", 45 → "45s"
// Used for Time to Accept display throughout the app.
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

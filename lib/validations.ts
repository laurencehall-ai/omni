// ─── Work item validation state ──────────────────────────────────────────────
// Tracks which AgentWork IDs the admin has marked as correctly routed (👍)
// or misrouted (👎). Persisted in localStorage so badges survive page navigation.
//
// The two sets are mutually exclusive: marking an item validated removes it
// from flagged, and vice versa. This prevents contradictory badge states.

const VALIDATED_KEY = "rc-validations"; // localStorage key for 👍 validated IDs
const FLAGGED_KEY = "rc-flagged";        // localStorage key for 👎 flagged/misrouted IDs

// Reads a JSON array from localStorage and returns it as a Set.
// Returns an empty Set if the key doesn't exist, can't be parsed, or we're on the server.
function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

// Serializes a Set to a JSON array and writes it to localStorage.
function writeSet(key: string, set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch { /* localStorage unavailable (e.g. private browsing with storage blocked) */ }
}

// Returns the set of AgentWork IDs the admin has marked as correctly routed.
export function getValidations(): Set<string> {
  return readSet(VALIDATED_KEY);
}

// Marks an AgentWork ID as correctly routed (👍).
// Also removes it from the flagged set if it was previously flagged.
export function markValidated(id: string): void {
  const s = readSet(VALIDATED_KEY);
  s.add(id);
  writeSet(VALIDATED_KEY, s);
  const f = readSet(FLAGGED_KEY);
  if (f.has(id)) { f.delete(id); writeSet(FLAGGED_KEY, f); }
}

// Returns the set of AgentWork IDs the admin has flagged as misrouted.
export function getFlagged(): Set<string> {
  return readSet(FLAGGED_KEY);
}

// Marks an AgentWork ID as misrouted (👎).
// Also removes it from the validated set if it was previously validated.
export function markFlagged(id: string): void {
  const f = readSet(FLAGGED_KEY);
  f.add(id);
  writeSet(FLAGGED_KEY, f);
  const v = readSet(VALIDATED_KEY);
  if (v.has(id)) { v.delete(id); writeSet(VALIDATED_KEY, v); }
}

// Clears both validated and flagged sets — used by the "Reset validations" button.
export function clearValidations(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(VALIDATED_KEY);
    localStorage.removeItem(FLAGGED_KEY);
  } catch { /* localStorage unavailable */ }
}

const STORAGE_KEY = "rc-validations";

export function getValidations(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function markValidated(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getValidations();
    current.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // localStorage unavailable — silently no-op
  }
}

export function clearValidations(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — silently no-op
  }
}

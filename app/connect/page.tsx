"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "Salesforce did not return an authorization code. Please try again.",
  session_expired: "Session expired. Please try connecting again.",
  token_exchange_failed: "Could not exchange the authorization code. Check your Client ID and Secret.",
};

function ConnectForm() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get("error");
  const errorMessage = errorKey ? (ERROR_MESSAGES[errorKey] ?? `Salesforce error: ${errorKey}`) : null;

  const [instanceUrl, setInstanceUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch("/api/auth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceUrl, clientId, clientSecret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Connection failed");
        return;
      }
      window.location.href = data.authUrl;
    } catch {
      setFormError("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-12">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Connect Your Salesforce Org</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
        RouteCause connects to your org via a Salesforce Connected App. Your credentials are stored only in your session and never persisted to disk.
      </p>

      {/* Setup checklist */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Before connecting, create a Connected App in your org:</p>
        <ol className="text-sm text-blue-700 dark:text-blue-400 list-decimal list-inside space-y-1">
          <li>Go to <strong>Setup → App Manager → New Connected App</strong></li>
          <li>Enable <strong>OAuth Settings</strong></li>
          <li>Set callback URL to: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{process.env.NEXT_PUBLIC_CALLBACK_URL ?? "http://localhost:3000/api/auth/callback"}</code></li>
          <li>Add OAuth scopes: <strong>api</strong>, <strong>refresh_token</strong>, <strong>offline_access</strong></li>
          <li>Save and copy the <strong>Consumer Key</strong> (Client ID) and <strong>Consumer Secret</strong></li>
        </ol>
      </div>

      {(errorMessage ?? formError) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 text-sm text-red-700 dark:text-red-400">
          {errorMessage ?? formError}
        </div>
      )}

      <form onSubmit={handleConnect} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Instance URL
          </label>
          <input
            type="url"
            placeholder="https://yourorg.my.salesforce.com"
            value={instanceUrl}
            onChange={(e) => setInstanceUrl(e.target.value)}
            required
            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Client ID (Consumer Key)
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Client Secret (Consumer Secret)
          </label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            required
            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
        >
          {loading ? "Redirecting to Salesforce…" : "Connect Org"}
        </button>
      </form>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectForm />
    </Suspense>
  );
}

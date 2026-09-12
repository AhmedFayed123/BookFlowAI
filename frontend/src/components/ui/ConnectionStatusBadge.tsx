"use client";

import { Cloud, CloudOff, LoaderCircle, RefreshCw } from "lucide-react";
import type { SignalRConnectionStatus } from "../../hooks/useSignalR";

const labels: Record<SignalRConnectionStatus, string> = {
  connected: "Live updates",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  disconnected: "Polling updates",
  error: "Polling updates",
};

export default function ConnectionStatusBadge({ status, onRetry }: { status: SignalRConnectionStatus; onRetry?: () => void }) {
  const pending = status === "connecting" || status === "reconnecting";
  const connected = status === "connected";
  const Icon = connected ? Cloud : pending ? LoaderCircle : CloudOff;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : pending ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"}`}
      role="status"
      title={connected ? "Changes arrive instantly." : "This page refreshes periodically until the live connection returns."}
    >
      <Icon className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
      <span>{labels[status]}</span>
      {!connected && !pending && onRetry && (
        <button type="button" onClick={onRetry} className="rounded-full p-0.5 hover:bg-slate-100" aria-label="Retry live connection">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

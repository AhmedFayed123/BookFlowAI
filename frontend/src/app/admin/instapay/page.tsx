"use client";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import WorkspaceShell from "../../../components/ui/WorkspaceShell";
import { useToast } from "../../../components/ui/ToastProvider";
import { instaPayApi, type InstaPayPendingTransaction } from "../../../lib/api";

function ReceiptPreview({ url }: { url: string }) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; let objectUrl = "";
    void instaPayApi.receipt(url).then((blob) => { if (active) { objectUrl = URL.createObjectURL(blob); setSource(objectUrl); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  if (failed) return <p role="alert" className="text-sm text-rose-700">Receipt could not be loaded.</p>;
  if (!source) return <p className="text-sm text-slate-500">Loading receipt…</p>;
  // Private receipt is fetched with authorization, then rendered as a local blob.
  // eslint-disable-next-line @next/next/no-img-element
  return <a href={source} target="_blank" rel="noreferrer"><img src={source} alt="Customer InstaPay transfer receipt" className="max-h-64 rounded-xl border object-contain" /></a>;
}

export default function InstaPayPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<InstaPayPendingTransaction[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const refresh = useCallback(async () => {
    try { setItems(await instaPayApi.pending()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Payments could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 0); const timer = window.setInterval(() => void refresh(), 15000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [refresh]);
  async function verify(id: number, approved: boolean) {
    setBusy(id);
    try { await instaPayApi.verify(id, approved, notes[id] ?? ""); toast(approved ? "Payment approved and customer notified." : "Payment rejected. Slot released.", approved ? "success" : "info"); await refresh(); }
    catch (e) { toast(e instanceof Error ? e.message : "Verification failed.", "error"); await refresh(); }
    finally { setBusy(null); }
  }
  return <ProtectedRoute requiredRole="Admin"><WorkspaceShell role="Admin" eyebrow="Payment verification" title="InstaPay transfers" description="Match each reference and amount against your business InstaPay transaction history before approving." actions={<button onClick={() => void refresh()} className="rounded-xl border px-4 py-2 text-sm">Refresh</button>}>
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>}
    {loading ? <p role="status">Loading pending payments…</p> : !items.length && !error ? <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">No transfers awaiting verification.</div> : <div className="grid gap-5 lg:grid-cols-2">{items.map((item) => <article key={item.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex justify-between gap-3"><div><h2 className="text-lg font-semibold">{item.customerName}</h2><p className="text-sm text-slate-500">Booking #{item.id} · {item.serviceName}</p></div><span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">Pending verification</span></div>
      <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Provider</dt><dd>{item.staffName}</dd></div><div><dt className="text-slate-500">Slot</dt><dd>{new Date(item.dateTime).toLocaleString()}</dd></div><div><dt className="text-slate-500">Amount</dt><dd className="font-semibold">EGP {item.price.toFixed(2)}</dd></div><div><dt className="text-slate-500">Reference</dt><dd className="font-mono">{item.instaPayRefNumber}</dd></div></dl>
      <p className="text-xs text-amber-800">Hold expires {new Date(item.lockExpiresAt).toLocaleTimeString()}</p>
      {item.receiptImageUrl ? <ReceiptPreview url={item.receiptImageUrl} /> : <p className="text-sm text-slate-500">No receipt attached.</p>}
      <label className="block text-sm">Verification note<textarea value={notes[item.id] ?? ""} maxLength={500} onChange={(e) => setNotes((prior) => ({ ...prior, [item.id]: e.target.value }))} className="mt-2 w-full rounded-xl border p-3" /></label>
      <div className="flex gap-3"><button disabled={busy !== null} onClick={() => void verify(item.id, true)} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === item.id ? "Processing…" : "Approve"}</button><button disabled={busy !== null} onClick={() => void verify(item.id, false)} className="rounded-xl border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-50">Reject</button></div>
    </article>)}</div>}
  </WorkspaceShell></ProtectedRoute>;
}

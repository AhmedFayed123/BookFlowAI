"use client";
import { useEffect, useState } from "react";
import { instaPayApi } from "../../lib/api";

export default function InstaPayCard({ amount, reference, receipt, onReference, onReceipt, onReady }: {
  amount: number; reference: string; receipt: File | null; onReference: (value: string) => void;
  onReceipt: (file: File | null) => void; onReady: (ready: boolean) => void;
}) {
  const [recipient, setRecipient] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    void instaPayApi.settings().then((settings) => {
      if (!active) return;
      setRecipient(settings.recipient); onReady(settings.enabled);
      if (!settings.enabled) setError("InstaPay is currently unavailable. Please contact support.");
    }).catch(() => { if (active) setError("Payment details could not be loaded. Reopen checkout to retry."); });
    return () => { active = false; onReady(false); };
  }, [onReady]);
  function select(file?: File) {
    if (file && (!["image/png", "image/jpeg"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError("Choose a PNG or JPEG receipt up to 5 MB."); return;
    }
    setError(""); onReceipt(file ?? null);
  }
  return <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50 p-5">
    <div className="flex items-center justify-between"><h5 className="text-lg font-semibold text-violet-950">Pay with InstaPay</h5><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">Manual verification</span></div>
    <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700"><li>Open InstaPay and transfer <strong>EGP {amount.toFixed(2)}</strong> to the account below.</li><li>Copy the 12-digit reference number from your successful transfer.</li><li>Submit your reference to hold the slot for 30 minutes while an admin verifies payment.</li></ol>
    <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-white p-3"><code className="break-all">{recipient ?? "Loading payment details?"}</code><button type="button" disabled={!recipient} onClick={async () => { try { await navigator.clipboard.writeText(recipient!); setCopied(true); } catch { setError("Copy failed. Select and copy the account manually."); } }} className="rounded-lg bg-violet-700 px-4 py-2 text-sm text-white disabled:opacity-50">{copied ? "Copied!" : "Copy"}</button></div>
    <label className="block text-sm font-medium">InstaPay reference number<input value={reference} onChange={(e) => onReference(e.target.value)} inputMode="numeric" maxLength={12} pattern="[0-9]{12}" placeholder="123456789012" className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3" aria-describedby="instapay-reference-help" /></label><p id="instapay-reference-help" className="text-xs text-slate-500">Exactly 12 digits. Each transfer reference can be submitted once.</p>
    <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); select(e.dataTransfer.files[0]); }} className="block cursor-pointer rounded-xl border-2 border-dashed border-violet-300 bg-white p-5 text-center text-sm text-slate-600">{receipt ? receipt.name : "Drop a receipt screenshot here or click to upload (optional)"}<input type="file" accept="image/png,image/jpeg" onChange={(e) => select(e.target.files?.[0])} className="mt-3 block w-full text-xs" aria-label="Transfer receipt screenshot" /></label>
    {receipt && <button type="button" onClick={() => onReceipt(null)} className="text-sm text-violet-800 underline">Remove receipt</button>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <p className="text-xs text-slate-600">The slot is held only after submission. If verification expires or payment is rejected, contact support about your transfer before paying again.</p>
  </section>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { businessInfoApi, type BusinessInfoDto } from "../../lib/api";
import AsyncState from "../ui/AsyncState";

export default function BusinessInfo() {
  const [items, setItems] = useState<BusinessInfoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await businessInfoApi.getInfo()).filter((item) => item.category !== "AIConfiguration")); }
    catch { setError("Business information is temporarily unavailable."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  return <section aria-label="Business information" className="space-y-4"><h2 className="text-xl font-semibold">Good to know before you book</h2><AsyncState loading={loading} error={error} retry={() => void load()} /><div className="grid gap-4 sm:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-semibold">{item.category}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{item.content}</p></article>)}</div>{!loading && !error && items.length === 0 && <p className="text-sm text-slate-500">Your provider can help with any questions about policies or working hours.</p>}</section>;
}

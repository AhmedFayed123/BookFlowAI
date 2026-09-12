"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApi, type AdminDashboardSummaryDto, type LiveBookingDto } from "../../lib/api";
import AsyncState, { cardClass } from "../ui/AsyncState";

export default function OperationsSnapshot() {
  const [summary, setSummary] = useState<AdminDashboardSummaryDto | null>(null);
  const [bookings, setBookings] = useState<LiveBookingDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [totals, live] = await Promise.all([adminApi.getDashboardSummary(), adminApi.getLiveBookings()]);
      setSummary(totals); setBookings(live); setError(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Live operations are unavailable."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const refresh = window.setInterval(() => void load(), 30000); return () => { window.clearTimeout(initial); window.clearInterval(refresh); }; }, [load]);
  return <section className={cardClass}><div className="flex justify-between gap-3"><div><h2 className="text-xl font-semibold">Today in the business</h2><p className="mt-1 text-xs text-slate-500">Server-calculated snapshot · refreshes every 30 seconds</p></div><button onClick={() => void load()} className="text-sm font-medium text-emerald-800">Refresh</button></div><AsyncState loading={loading} error={error} retry={() => void load()} />{summary && !error && <><div className="grid gap-4 sm:grid-cols-3">{[["Expected revenue", `$${summary.expectedRevenueToday.toFixed(2)}`], ["Completed today", summary.completedBookingsToday], ["High-risk bookings", summary.highRiskNoShowsCount]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div><div className="space-y-2">{bookings.length === 0 && <p className="text-sm text-slate-500">No appointments today.</p>}{bookings.map((booking) => <Link key={booking.id} href={`/bookings/${booking.id}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50"><span>{booking.customerName} · {booking.serviceName}</span><span className="text-slate-500">{new Date(booking.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {booking.isActiveNow ? "In progress" : booking.status}</span></Link>)}</div></>}</section>;
}

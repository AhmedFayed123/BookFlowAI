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

  return (
    <section className={`${cardClass} h-full rounded-3xl p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-indigo-700">Live operations</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Today&apos;s timeline</h2><p className="mt-1 text-xs text-slate-500">Updates every 30 seconds</p></div>
        <button type="button" onClick={() => void load()} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">Refresh</button>
      </div>
      <AsyncState loading={loading} error={error} retry={() => void load()} />
      {summary && !error && <>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[["Expected revenue", `$${summary.expectedRevenueToday.toFixed(2)}`], ["Completed", summary.completedBookingsToday], ["High risk", summary.highRiskNoShowsCount]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900">{value}</p></div>)}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">On the schedule</h3><span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">{bookings.length} today</span></div>
          {bookings.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center"><p className="text-sm font-medium text-slate-700">No appointments today</p><p className="mt-1 text-xs text-slate-500">New bookings will appear here.</p></div> : <div className="relative max-h-[420px] space-y-2 overflow-y-auto pl-4 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-indigo-100">
            {bookings.map((booking) => <Link key={booking.id} href={`/bookings/${booking.id}`} className="relative block rounded-xl border border-slate-200/80 bg-white p-3 transition hover:border-indigo-200 hover:bg-indigo-50/30">
              <span className={`absolute -left-[15px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${booking.isActiveNow ? "bg-blue-500" : booking.status === "Completed" ? "bg-emerald-500" : booking.status === "NoShow" ? "bg-rose-500" : "bg-indigo-400"}`} />
              <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-sm font-semibold text-slate-900">{booking.customerName}</p><span className="shrink-0 text-xs font-semibold text-slate-600">{new Date(booking.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
              <p className="mt-1 truncate text-xs text-slate-500">{booking.serviceName}</p>
              <div className="mt-2"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${booking.isActiveNow ? "bg-blue-50 text-blue-700" : booking.status === "Completed" ? "bg-emerald-50 text-emerald-700" : booking.status === "NoShow" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{booking.isActiveNow ? "In progress" : booking.status}</span></div>
            </Link>)}
          </div>}
        </div>
      </>}
    </section>
  );
}

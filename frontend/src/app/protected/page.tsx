"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock3, RotateCw } from "lucide-react";
import ProtectedRoute from "../../components/auth/ProtectedRoute";
import { useToast } from "../../components/ui/ToastProvider";
import WorkspaceShell from "../../components/ui/WorkspaceShell";
import { BOOKINGS_CHANGED_EVENT } from "../../lib/notifications";
import { bookingsApi, type BookingDetailDto } from "../../lib/api";

const statusStyles: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800", Confirmed: "bg-blue-100 text-blue-800",
  Completed: "bg-emerald-100 text-emerald-800", Cancelled: "bg-slate-100 text-slate-600", NoShow: "bg-rose-100 text-rose-800",
};

export default function CustomerWorkspacePage() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<BookingDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); setBookings(await bookingsApi.getMyBookings()); }
    catch (caught) { const message = caught instanceof Error ? caught.message : "Could not load your bookings."; setError(message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const refresh = () => void load(); const timer = window.setTimeout(refresh, 0); window.addEventListener(BOOKINGS_CHANGED_EVENT, refresh); const poll = window.setInterval(refresh, 60000); return () => { window.clearTimeout(timer); window.clearInterval(poll); window.removeEventListener(BOOKINGS_CHANGED_EVENT, refresh); }; }, [load]);

  const cancel = async (booking: BookingDetailDto) => {
    if (!window.confirm(`Cancel your booking for ${booking.serviceName}?`)) return;
    try { await bookingsApi.cancel(booking.id); setBookings((items) => items.map((item) => item.id === booking.id ? { ...item, status: "Cancelled" } : item)); toast("Booking cancelled.", "success"); }
    catch (caught) { toast(caught instanceof Error ? caught.message : "Could not cancel the booking.", "error"); }
  };

  return <ProtectedRoute requiredRole="Customer"><WorkspaceShell role="Customer" eyebrow="Customer workspace" title="Your bookings" description="Track upcoming appointments, revisit past services, and keep your plans in one place." actions={<Link href="/#services" className="rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-950 transition-all duration-200 ease-in-out hover:bg-emerald-50">Book another service</Link>}>
    {loading ? <div className="grid gap-4 md:grid-cols-2">{[1,2,3,4].map((item) => <div key={item} className="h-48 skeleton-shimmer rounded-2xl bg-slate-200" />)}</div>
      : error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center"><p className="font-semibold text-rose-900">{error}</p><button onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white"><RotateCw className="h-4 w-4" />Retry</button></div>
      : bookings.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><CalendarDays className="mx-auto h-10 w-10 text-emerald-600" /><h2 className="mt-4 text-xl font-semibold">No bookings yet</h2><p className="mt-2 text-slate-500">Your upcoming and past appointments will appear here.</p><Link href="/#services" className="mt-5 inline-block rounded-xl button-primary px-4 py-3 text-sm font-semibold text-white">Explore services</Link></div>
      : <div className="grid gap-4 md:grid-cols-2">{bookings.map((booking) => <article key={booking.id} className="surface-card rounded-2xl p-5 shadow-sm transition-all duration-200 ease-in-out "><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700"><Link href={`/bookings/${booking.id}`} className="underline underline-offset-4">View booking #{booking.id}</Link></p><h2 className="mt-2 text-xl font-semibold text-slate-950"><Link href={`/bookings/${booking.id}`} className="hover:text-emerald-800">{booking.serviceName}</Link></h2></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${booking.status === "PendingInstaPay" ? "bg-amber-100 text-amber-900" : statusStyles[booking.status] ?? "bg-slate-100"}`}>{booking.status === "PendingInstaPay" ? "⏳ Pending InstaPay verification" : booking.status}</span></div><div className="mt-5 space-y-2 text-sm text-slate-600"><p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-700" />{new Date(booking.dateTime).toLocaleDateString(undefined, { dateStyle: "full" })}</p><p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-700" />{new Date(booking.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {booking.durationInMinutes} minutes</p><p>Provider: <strong>{booking.staffName}</strong></p></div><div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-4"><span className="text-xl font-semibold">${booking.price.toFixed(2)}</span>{(booking.status === "Pending" || booking.status === "PendingInstaPay" || booking.status === "Confirmed") && new Date(booking.dateTime) > new Date() && <button onClick={() => void cancel(booking)} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition-all duration-200 ease-in-out hover:bg-rose-50">Cancel booking</button>}</div></article>)}</div>}
  </WorkspaceShell></ProtectedRoute>;
}

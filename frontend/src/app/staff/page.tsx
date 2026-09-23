"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, LayoutGrid, List, Phone, Sparkles, X } from "lucide-react";
import ProtectedRoute from "../../components/auth/ProtectedRoute";
import ConnectionStatusBadge from "../../components/ui/ConnectionStatusBadge";
import { useToast } from "../../components/ui/ToastProvider";
import WorkspaceShell from "../../components/ui/WorkspaceShell";
import AsyncState from "../../components/ui/AsyncState";
import { useSignalR } from "../../hooks/useSignalR";
import {
  bookingsApi,
  staffApi,
  type BookingNotification,
  type BookingStatusUpdate,
  type StaffBookingItemDto,
  type StaffScheduleDto,
} from "../../lib/api";
import { toLocalDateInputValue } from "../../lib/booking";

const statusStyle: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-900 ring-amber-200",
  PendingInstaPay: "bg-amber-100 text-amber-900 ring-amber-200",
  Confirmed: "bg-blue-100 text-blue-900 ring-blue-200",
  Completed: "bg-slate-100 text-slate-700 ring-slate-200",
  Cancelled: "bg-slate-200 text-slate-700 ring-slate-300",
  NoShow: "bg-rose-100 text-rose-900 ring-rose-200",
};

const minutesFromTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const formatDuration = (value: number) => `${Math.floor(value / 60)}h ${value % 60}m`;

export default function StaffWorkspacePage() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<StaffBookingItemDto[]>([]);
  const [schedule, setSchedule] = useState<StaffScheduleDto[]>([]);
  const [selectedDate, setSelectedDate] = useState(toLocalDateInputValue(new Date()));
  const [dayOffDate, setDayOffDate] = useState("");
  const [dayOffReason, setDayOffReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<StaffBookingItemDto | null>(null);
  const [scheduleView, setScheduleView] = useState<"agenda" | "list">("agenda");
  const [clockTick, setClockTick] = useState(0);

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      setBookings(await staffApi.getMyBookings(selectedDate));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadBookings();
      void staffApi.getMySchedule().then(setSchedule).catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "Could not load schedule.");
      });
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadBookings]);

  const applyStatus = (payload: BookingStatusUpdate) => {
    setBookings((current) => current.map((booking) =>
      booking.id === payload.bookingId ? { ...booking, status: payload.status } : booking));
    setNotice(payload.message);
  };

  const { connectionStatus, reconnect } = useSignalR({
    handlers: {
      ReceiveNewBooking: (payload: BookingNotification) => {
        if (payload.dateTime?.slice(0, 10) === selectedDate) void loadBookings();
        setNotice(payload.message ?? "A new booking was assigned to you.");
      },
      ReceiveBookingUpdate: applyStatus,
      BookingStatusUpdated: applyStatus,
    },
  });

  useEffect(() => {
    if (connectionStatus === "connected") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadBookings();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [connectionStatus, loadBookings]);

  const updateStatus = async (
    bookingId: number,
    action: "confirm" | "complete" | "mark-no-show",
  ) => {
    try {
      const result = await bookingsApi.updateStatus(bookingId, action);
      setNotice(result.message);
      toast(result.message, "success");
      await loadBookings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update booking.";
      setNotice(message);
      toast(message, "error");
    }
  };

  const requestDayOff = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await staffApi.requestDayOff({ date: dayOffDate, reason: dayOffReason || null });
      setNotice(result.message);
      setDayOffDate("");
      setDayOffReason("");
      toast(result.message, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit the request.";
      setNotice(message);
      toast(message, "error");
    }
  };

  const now = useMemo(() => new Date(), [clockTick]);
  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!selectedBooking) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedBooking(null); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedBooking]);

  const sortedBookings = useMemo(() => [...bookings].sort((left, right) => new Date(left.dateTime).getTime() - new Date(right.dateTime).getTime()), [bookings]);
  const completedCount = bookings.filter((booking) => booking.status === "Completed").length;
  const bookedMinutes = bookings.filter((booking) => booking.status !== "Cancelled" && booking.status !== "NoShow").reduce((total, booking) => total + booking.durationInMinutes, 0);
  const shift = schedule.find((item) => item.dayOfWeek === new Date(`${selectedDate}T12:00:00`).getDay());
  const shiftMinutes = shift ? Math.max(0, minutesFromTime(shift.endTime) - minutesFromTime(shift.startTime)) : 0;
  const capacityPercent = shiftMinutes ? Math.min(100, Math.round((bookedMinutes / shiftMinutes) * 100)) : 0;
  const today = toLocalDateInputValue(now);
  const nextBooking = sortedBookings.find((booking) => new Date(booking.dateTime) > now && booking.status !== "Cancelled" && booking.status !== "Completed" && booking.status !== "NoShow");
  const pendingBookings = sortedBookings.filter((booking) => booking.status === "Pending");
  const upcomingDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() + index); return toLocalDateInputValue(date);
  });
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const countdown = nextBooking ? Math.max(0, Math.floor((new Date(nextBooking.dateTime).getTime() - now.getTime()) / 60000)) : null;

  return (
    <ProtectedRoute requiredRole="Staff">
      <WorkspaceShell role="Staff" eyebrow="Daily operations" title="Your schedule" description="Your appointments, customer details, and shift at a glance." actions={<ConnectionStatusBadge status={connectionStatus} onRetry={() => void reconnect()} />}>
        <div className="space-y-6">
          {notice && <div role="status" className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-indigo-900">{notice}</div>}

          <section className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 p-5 text-white shadow-[0_20px_55px_-25px_rgba(15,23,42,.48)] sm:p-7">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
            <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div><p className="flex items-center gap-2 text-sm font-medium text-indigo-200"><Sparkles className="h-4 w-4" />Daily operations companion</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{greeting}.</h2><p className="mt-2 text-sm text-slate-300">You have <span className="font-semibold text-white">{bookings.length} {bookings.length === 1 ? "appointment" : "appointments"}</span> for {selectedDate === today ? "today" : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}.</p></div>
              <div className="flex items-center gap-3"><div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-slate-200"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${shift ? "bg-emerald-400" : "bg-slate-400"}`} />{shift ? "Shift scheduled" : "No shift set"}</div></div>
            </div>
            <div className="relative mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Choose schedule date">
              {upcomingDates.map((date) => <button key={date} type="button" onClick={() => setSelectedDate(date)} aria-pressed={selectedDate === date} className={`min-h-14 min-w-[4.4rem] rounded-2xl border px-3 py-2 text-center transition ${selectedDate === date ? "border-white bg-white text-slate-950 shadow-lg" : "border-white/15 bg-white/[.06] text-slate-200 hover:bg-white/10"}`}><span className="block text-[11px] font-medium opacity-70">{date === today ? "Today" : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span><span className="mt-0.5 block text-sm font-semibold">{new Date(`${date}T12:00:00`).getDate()}</span></button>)}
              <label className="sr-only" htmlFor="staff-date-picker">Choose another date</label><input id="staff-date-picker" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="min-h-14 w-12 shrink-0 cursor-pointer rounded-2xl border border-white/15 bg-white/[.06] px-2 text-transparent [color-scheme:dark]" />
            </div>
          </section>

          {nextBooking && <section className="surface-card flex flex-col gap-4 rounded-3xl border-l-4 border-l-indigo-500 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-label="Next appointment">
            <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-indigo-700">Next client {countdown !== null && <span className="ml-2 rounded-full bg-indigo-50 px-2 py-1 normal-case tracking-normal">in {countdown < 60 ? `${countdown} min` : `${Math.floor(countdown / 60)}h ${countdown % 60}m`}</span>}</p><h3 className="mt-2 text-xl font-semibold text-slate-950">{nextBooking.customerName}</h3><p className="mt-1 text-sm text-slate-600">{nextBooking.serviceName} آ· {new Date(nextBooking.dateTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></div>
            <div className="flex gap-2"><a href={`tel:${nextBooking.customerPhone}`} aria-label={`Call ${nextBooking.customerName}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Phone className="h-4 w-4" />Call</a><button type="button" onClick={() => setSelectedBooking(nextBooking)} className="min-h-12 rounded-xl button-primary px-5 text-sm font-semibold text-white">View appointment</button></div>
          </section>}

          <section aria-label="Daily performance" className="grid gap-3 sm:grid-cols-3">
            <article className="surface-card rounded-2xl p-4 sm:p-5"><div className="flex justify-between text-sm text-slate-500"><span>Today&apos;s appointments</span><CalendarDays className="h-4 w-4 text-indigo-600" /></div><p className="mt-3 text-2xl font-semibold text-slate-950">{completedCount}<span className="text-base font-medium text-slate-400"> / {bookings.length}</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${bookings.length ? (completedCount / bookings.length) * 100 : 0}%` }} /></div><p className="mt-2 text-xs text-slate-500">Completed appointments</p></article>
            <article className="surface-card rounded-2xl p-4 sm:p-5"><div className="flex justify-between text-sm text-slate-500"><span>Booked value</span><span className="text-xs">Scheduled services</span></div><p className="mt-3 text-2xl font-semibold text-slate-950">{bookings.filter((booking) => booking.status !== "Cancelled" && booking.status !== "NoShow").reduce((total, booking) => total + booking.price, 0).toLocaleString(undefined, { style: "currency", currency: "EGP" })}</p><p className="mt-2 text-xs text-slate-500">Appointment value آ· not commission</p></article>
            <article className="surface-card rounded-2xl p-4 sm:p-5"><div className="flex justify-between text-sm text-slate-500"><span>Shift capacity</span><Clock3 className="h-4 w-4 text-indigo-600" /></div><p className="mt-3 text-2xl font-semibold text-slate-950">{shiftMinutes ? `${formatDuration(bookedMinutes)} / ${formatDuration(shiftMinutes)}` : "No shift set"}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${capacityPercent}%` }} /></div><p className="mt-2 text-xs text-slate-500">{shiftMinutes ? `${capacityPercent}% of scheduled shift` : "Check your weekly shifts below"}</p></article>
          </section>

          {pendingBookings.length > 0 && <section aria-label="Pending approvals" className="space-y-3"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-amber-700">Needs your attention</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Pending approvals <span className="text-sm font-medium text-slate-500">({pendingBookings.length})</span></h2></div><span className="text-xs text-slate-500">Swipe to review</span></div><div className="flex snap-x gap-3 overflow-x-auto pb-2">{pendingBookings.map((booking) => <article key={booking.id} className="surface-card w-[min(88vw,360px)] shrink-0 snap-start rounded-2xl border-amber-200/80 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{booking.customerName}</h3><p className="mt-1 text-sm text-slate-600">{booking.serviceName}</p><p className="mt-2 text-xs text-slate-500">{new Date(booking.dateTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} آ· {booking.durationInMinutes} min</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Pending</span></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => void updateStatus(booking.id, "confirm")} className="min-h-12 flex-1 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">Confirm</button><button type="button" onClick={() => setSelectedBooking(booking)} className="min-h-12 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Review</button></div></article>)}</div></section>}

          <section className="surface-card overflow-hidden rounded-3xl shadow-sm">
            <header className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-indigo-700">Daily operations</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Your schedule</h2><p className="mt-1 text-sm text-slate-500">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p></div><div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Schedule view"><button type="button" onClick={() => setScheduleView("agenda")} aria-pressed={scheduleView === "agenda"} className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold sm:flex-none ${scheduleView === "agenda" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}><LayoutGrid className="h-4 w-4" />Agenda</button><button type="button" onClick={() => setScheduleView("list")} aria-pressed={scheduleView === "list"} className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold sm:flex-none ${scheduleView === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}><List className="h-4 w-4" />List</button></div></header>
            {loading ? <div className="p-5"><AsyncState loading /></div> : sortedBookings.length === 0 ? <div className="px-5 py-14 text-center sm:py-20"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><CalendarDays className="h-6 w-6" /></span><h3 className="mt-4 font-semibold text-slate-900">A clear day ahead</h3><p className="mt-1 text-sm text-slate-500">There are no appointments scheduled for this date.</p></div> : <div className={`relative p-4 sm:p-6 ${scheduleView === "list" ? "space-y-3" : "space-y-4"}`}>
              {selectedDate === today && <div className="sticky top-3 z-10 flex items-center gap-3 py-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100" /><span className="h-px flex-1 bg-rose-300" /><span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">Now آ· {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>}
              {sortedBookings.map((booking) => {
                const startsAt = new Date(booking.dateTime);
                const endsAt = new Date(startsAt.getTime() + booking.durationInMinutes * 60_000);
                return <article key={booking.id} className={`grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-sm sm:items-center ${scheduleView === "agenda" ? "sm:grid-cols-[6.5rem_1fr_auto] sm:border-l-4 sm:border-l-indigo-200 sm:p-5" : "sm:grid-cols-[5rem_1fr_auto] sm:py-3"}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:block"><span>{startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span className="text-slate-400 sm:hidden">-</span><span className="text-xs font-medium text-slate-500 sm:mt-1 sm:block">{booking.durationInMinutes} min</span></div>
                  <button type="button" onClick={() => setSelectedBooking(booking)} className="flex min-w-0 items-center gap-3 text-left"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">{booking.customerName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate font-semibold text-slate-950">{booking.customerName}</span><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusStyle[booking.status] ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}>{booking.status}</span></span><span className="mt-1 block truncate text-sm text-slate-600">{booking.serviceName} آ· {booking.price.toLocaleString(undefined, { style: "currency", currency: "EGP" })}</span><span className="mt-1 block text-xs text-slate-500">Until {endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span></button>
                  <div className="flex items-center gap-2 sm:justify-end"><a href={`tel:${booking.customerPhone}`} aria-label={`Call ${booking.customerName}`} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"><Phone className="h-4 w-4" /></a><button type="button" onClick={() => setSelectedBooking(booking)} className="min-h-12 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none">Details</button></div>
                </article>;
              })}
            </div>}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="surface-card rounded-2xl p-5 sm:p-6"><h2 className="font-semibold text-slate-950">Weekly shifts</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{schedule.length ? schedule.map((item) => <div key={item.id} className={`rounded-xl border p-3 text-sm ${shift?.id === item.id ? "border-indigo-200 bg-indigo-50/70 text-indigo-900" : "border-slate-200 bg-slate-50 text-slate-600"}`}><span className="font-medium">{new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date(2024, 0, 7 + item.dayOfWeek))}</span><span className="mt-1 block text-xs opacity-75">{item.startTime.slice(0, 5)}â€“{item.endTime.slice(0, 5)}</span></div>) : <p className="text-sm text-slate-500">No shifts assigned.</p>}</div></div>
            <form onSubmit={requestDayOff} className="surface-card rounded-2xl p-5 sm:p-6"><h2 className="font-semibold text-slate-950">Request time off</h2><p className="mt-1 text-sm text-slate-500">Send a day off request to your manager.</p><input aria-label="Requested day off" type="date" min={today} value={dayOffDate} onChange={(event) => setDayOffDate(event.target.value)} required className="mt-4 min-h-12 w-full rounded-xl border border-slate-200 px-3 text-sm" /><textarea value={dayOffReason} onChange={(event) => setDayOffReason(event.target.value)} placeholder="Reason (optional)" className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" /><button type="submit" className="mt-3 min-h-12 w-full rounded-xl button-primary px-4 font-semibold text-white">Submit request</button></form>
          </section>

          {selectedBooking && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 backdrop-blur-sm sm:items-stretch sm:justify-end" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBooking(null); }}><aside role="dialog" aria-modal="true" aria-labelledby="staff-booking-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:h-full sm:max-h-full sm:max-w-lg sm:rounded-none sm:rounded-l-3xl"><header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 p-5 backdrop-blur-xl sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-indigo-700">Appointment #{selectedBooking.id}</p><h2 id="staff-booking-title" className="mt-2 text-2xl font-semibold text-slate-950">{selectedBooking.customerName}</h2><p className="mt-1 text-sm text-slate-500">{selectedBooking.serviceName}</p></div><button type="button" onClick={() => setSelectedBooking(null)} aria-label="Close appointment details" className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200 text-slate-600"><X className="h-5 w-5" /></button></header><div className="space-y-5 p-5 sm:p-6"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Appointment</p><p className="mt-2 font-semibold text-slate-950">{new Date(selectedBooking.dateTime).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</p><p className="mt-1 text-sm text-slate-600">{selectedBooking.durationInMinutes} minutes آ· {selectedBooking.price.toLocaleString(undefined, { style: "currency", currency: "EGP" })}</p></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-medium text-slate-500">Customer contact</p><p className="mt-1 font-semibold text-slate-900">{selectedBooking.customerName}</p><a href={`tel:${selectedBooking.customerPhone}`} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-indigo-700"><Phone className="h-4 w-4" />{selectedBooking.customerPhone || "Call customer"}</a></div><div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"><span className="text-sm font-medium text-slate-600">Current status</span><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${statusStyle[selectedBooking.status] ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}>{selectedBooking.status}</span></div><Link href={`/bookings/${selectedBooking.id}`} className="inline-flex min-h-12 items-center text-sm font-semibold text-indigo-700 underline underline-offset-4">Open full booking record</Link><div className="border-t border-slate-200 pt-5"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Quick actions</p><div className="grid gap-2">{selectedBooking.status === "Pending" && <button type="button" onClick={() => void updateStatus(selectedBooking.id, "confirm")} className="min-h-12 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"><Check className="mr-2 inline h-4 w-4" />Confirm appointment</button>}{(selectedBooking.status === "Pending" || selectedBooking.status === "Confirmed") && <button type="button" onClick={() => void updateStatus(selectedBooking.id, "complete")} className="min-h-12 rounded-xl button-primary px-4 text-sm font-semibold text-white">Complete service</button>}{(selectedBooking.status === "Pending" || selectedBooking.status === "Confirmed") && <button type="button" onClick={() => void updateStatus(selectedBooking.id, "mark-no-show")} className="min-h-12 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50">Mark as no-show</button>}</div></div></div></aside></div>}
        </div>
      </WorkspaceShell>
    </ProtectedRoute>
  );
}

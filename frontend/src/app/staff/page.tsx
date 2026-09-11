"use client";

import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "../../components/auth/ProtectedRoute";
import { useSignalR } from "../../hooks/useSignalR";
import {
  bookingsApi,
  staffApi,
  type BookingNotification,
  type BookingStatusUpdate,
  type StaffBookingItemDto,
  type StaffScheduleDto,
} from "../../lib/api";

const statusStyle: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Confirmed: "bg-blue-100 text-blue-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-slate-200 text-slate-700",
  NoShow: "bg-rose-100 text-rose-800",
};

export default function StaffWorkspacePage() {
  const [bookings, setBookings] = useState<StaffBookingItemDto[]>([]);
  const [schedule, setSchedule] = useState<StaffScheduleDto[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dayOffDate, setDayOffDate] = useState("");
  const [dayOffReason, setDayOffReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const { isConnected } = useSignalR({
    handlers: {
      ReceiveNewBooking: (payload: BookingNotification) => {
        if (payload.dateTime?.slice(0, 10) === selectedDate) void loadBookings();
        setNotice(payload.message ?? "A new booking was assigned to you.");
      },
      ReceiveBookingUpdate: applyStatus,
      BookingStatusUpdated: applyStatus,
    },
  });

  const updateStatus = async (
    bookingId: number,
    action: "confirm" | "complete" | "mark-no-show",
  ) => {
    try {
      const result = await bookingsApi.updateStatus(bookingId, action);
      setNotice(result.message);
      await loadBookings();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update booking.");
    }
  };

  const requestDayOff = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await staffApi.requestDayOff({ date: dayOffDate, reason: dayOffReason || null });
      setNotice(result.message);
      setDayOffDate("");
      setDayOffReason("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not submit the request.");
    }
  };

  return (
    <ProtectedRoute requiredRole="Staff">
      <main className="min-h-screen bg-slate-100 px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Provider workspace</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">My schedule and bookings</h1></div>
            <span className={`rounded-full px-3 py-2 text-sm font-semibold ${isConnected ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-600"}`}>
              {isConnected ? "Live updates on" : "Reconnecting"}
            </span>
          </header>

          {notice && <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">{notice}</div>}

          <section className="grid gap-6 lg:grid-cols-[1fr_1.7fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-bold text-slate-900">Weekly shifts</h2>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {schedule.length ? schedule.map((shift) => <div key={shift.id} className="rounded-xl bg-slate-50 p-3">
                    {new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date(2024, 0, 7 + shift.dayOfWeek))}: {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
                  </div>) : <p>No shifts assigned.</p>}
                </div>
              </div>

              <form onSubmit={requestDayOff} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-bold text-slate-900">Request time off</h2>
                <input type="date" min={new Date().toISOString().slice(0, 10)} value={dayOffDate} onChange={(event) => setDayOffDate(event.target.value)} required className="mt-4 w-full rounded-xl border border-slate-200 p-3" />
                <textarea value={dayOffReason} onChange={(event) => setDayOffReason(event.target.value)} placeholder="Reason (optional)" className="mt-3 w-full rounded-xl border border-slate-200 p-3" />
                <button className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white">Submit request</button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold text-slate-900">Assigned bookings</h2>
                <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="rounded-xl border border-slate-200 p-2" />
              </div>
              <div className="mt-5 space-y-3">
                {loading ? <p className="text-slate-500">Loading…</p> : bookings.length === 0 ? <p className="text-slate-500">No bookings for this date.</p> : bookings.map((booking) => (
                  <article key={booking.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold text-slate-900">{booking.serviceName}</h3>
                      <p className="text-sm text-slate-500">{booking.customerName} · {new Date(booking.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div>
                      <span className={`h-fit rounded-full px-3 py-1 text-xs font-bold ${statusStyle[booking.status] ?? "bg-slate-100 text-slate-700"}`}>{booking.status}</span>
                    </div>
                    {(booking.status === "Pending" || booking.status === "Confirmed") && <div className="mt-4 flex flex-wrap gap-2">
                      {booking.status === "Pending" && <button onClick={() => void updateStatus(booking.id, "confirm")} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Confirm</button>}
                      <button onClick={() => void updateStatus(booking.id, "complete")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Complete</button>
                      <button onClick={() => void updateStatus(booking.id, "mark-no-show")} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white">No-show</button>
                    </div>}
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}

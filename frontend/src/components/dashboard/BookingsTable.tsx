"use client";

import Link from "next/link";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X, CalendarDays, Clock3 } from "lucide-react";
import type { AdminBookingDto } from "../../lib/api";

type BookingsTableProps = {
  bookings: AdminBookingDto[];
  onCancelBooking: (bookingId: number) => Promise<void> | void;
  onStatusChange: (
    bookingId: number,
    status: "confirm" | "complete" | "mark-no-show",
  ) => Promise<void> | void;
};

const getStatusClasses = (status: string) => {
  switch (status) {
    case "PendingInstaPay":
    case "Pending":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "Confirmed":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "Completed":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "Cancelled":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "NoShow":
      return "bg-red-100 text-red-700 ring-red-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
};

const getRiskClasses = (probability?: number | null) => {
  if (typeof probability !== "number") {
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }

  if (probability >= 0.7) {
    return "bg-red-100 text-red-700 ring-red-200";
  }

  if (probability >= 0.4) {
    return "bg-yellow-100 text-yellow-700 ring-yellow-200";
  }

  return "bg-green-100 text-green-700 ring-green-200";
};

const formatDateTime = (dateValue: string) =>
  new Date(dateValue).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function BookingsTable({
  bookings,
  onCancelBooking,
  onStatusChange,
}: BookingsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [staffFilter, setStaffFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingDto | null>(null);
  const closeDrawerRef = useRef<HTMLButtonElement | null>(null);
  const pageSize = 10;

  useEffect(() => {
    if (!selectedBooking) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedBooking(null); };
    document.addEventListener("keydown", closeOnEscape);
    closeDrawerRef.current?.focus();
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedBooking]);

  useEffect(() => {
    const applyGlobalSearch = (event: Event) => {
      const query = (event as CustomEvent<{ query?: string }>).detail?.query ?? "";
      setSearch(query);
      setPage(1);
    };
    window.addEventListener("bookflow:admin-search", applyGlobalSearch);
    return () => window.removeEventListener("bookflow:admin-search", applyGlobalSearch);
  }, []);

  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          booking.serviceName,
          booking.customerName,
          booking.staffName,
          booking.status,
          booking.serviceId,
          booking.staffId,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "All" || booking.status === statusFilter;
      const matchesStaff = staffFilter === "All" || booking.staffName === staffFilter;
      const bookingDate = new Date(booking.dateTime);
      const today = new Date();
      const matchesDate = dateFilter === "All" || (dateFilter === "Today"
        ? bookingDate.toDateString() === today.toDateString()
        : bookingDate >= new Date(today.getTime() - (dateFilter === "7 days" ? 7 : 30) * 86400000));

      return matchesSearch && matchesStatus && matchesStaff && matchesDate;
    });
  }, [bookings, search, statusFilter, staffFilter, dateFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const visibleBookings = filteredBookings.slice((page - 1) * pageSize, page * pageSize);
  const staffNames = Array.from(new Set(bookings.map((booking) => booking.staffName))).sort();
  const toggleSelected = (bookingId: number) => setSelectedIds((current) => current.includes(bookingId) ? current.filter((id) => id !== bookingId) : [...current, bookingId]);

  return (
    <div className="surface-card rounded-3xl p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-emerald-700">
            Live bookings
          </div>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">
            Bookings feed
          </h3>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap md:items-center">
          <label className="relative"><span className="sr-only">Search bookings</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search bookings"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-400 md:w-64"
          /></label>

          <label className="relative"><span className="sr-only">Filter by status</span><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><select
            value={statusFilter}
            onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="All">All statuses</option>
            <option value="PendingInstaPay">Pending InstaPay</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="NoShow">No Show</option>
          </select></label>
          <label><span className="sr-only">Filter by staff</span><select value={staffFilter} onChange={(event) => { setStaffFilter(event.target.value); setPage(1); }} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-indigo-400"><option value="All">All staff</option>{staffNames.map((staffName) => <option key={staffName} value={staffName}>{staffName}</option>)}</select></label>
          <label><span className="sr-only">Filter by appointment date</span><select value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1); }} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-indigo-400"><option value="All">All dates</option><option>Today</option><option>7 days</option><option>30 days</option></select></label>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl">
        <table className="min-w-[900px] w-full border-separate border-spacing-y-2 text-left">
          <thead>
            <tr className="sticky top-0 bg-white text-xs tracking-wide text-slate-500">
              <th className="px-3 py-2 font-semibold">Customer</th>
              <th className="w-10 px-2 py-2"><input type="checkbox" aria-label="Select visible bookings" checked={visibleBookings.length > 0 && visibleBookings.every((booking) => selectedIds.includes(booking.id))} onChange={(event) => setSelectedIds((current) => event.target.checked ? Array.from(new Set([...current, ...visibleBookings.map((booking) => booking.id)])) : current.filter((id) => !visibleBookings.some((booking) => booking.id === id)))} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" /></th>
              <th className="px-3 py-2 font-semibold">Service</th>
              <th className="px-3 py-2 font-semibold">Staff</th>
              <th className="px-3 py-2 font-semibold">Schedule</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Risk</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredBookings.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-sm text-slate-500"
                >
                  No bookings match the current filters.
                </td>
              </tr>
            ) : (
              visibleBookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="rounded-xl bg-white text-sm text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,.035)] ring-1 ring-slate-200/80 transition-all duration-200 ease-in-out hover:bg-indigo-50/30 hover:shadow-sm animate-[fadeIn_0.35s_ease]"
                >
                  <td className="rounded-l-2xl px-3 py-3">
                    <button type="button" onClick={() => setSelectedBooking(booking)} className="text-left font-semibold text-slate-900 hover:text-indigo-700 focus-visible:underline">
                      {booking.customerName}
                    </button>
                    <Link href={`/bookings/${booking.id}`} className="text-xs text-emerald-800 underline underline-offset-4">View #{booking.id}</Link>
                  </td>
                  <td className="px-2 py-3"><input type="checkbox" aria-label={`Select booking ${booking.id}`} checked={selectedIds.includes(booking.id)} onChange={() => toggleSelected(booking.id)} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" /></td>

                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-800">
                      {booking.serviceName}
                    </div>
                    <div className="text-xs text-slate-500">
                      ${booking.price.toFixed(2)}
                    </div>
                  </td>

                  <td className="px-3 py-3">{booking.staffName}</td>

                  <td className="px-3 py-3">
                    {formatDateTime(booking.dateTime)}
                  </td>

                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusClasses(booking.status)}`}
                    >
                      {booking.status === "PendingInstaPay" ? "⏳ Pending InstaPay verification" : booking.status}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getRiskClasses(booking.noShowProbability)}`}
                    >
                      {typeof booking.noShowProbability === "number"
                        ? `${(booking.noShowProbability * 100).toFixed(0)}%`
                        : "N/A"}
                    </span>
                  </td>

                  <td className="rounded-r-2xl px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {booking.status === "Pending" && <button
                        type="button"
                        onClick={() =>
                          void onStatusChange(booking.id, "confirm")
                        }
                        className="min-h-9 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-all duration-200 ease-in-out hover:bg-indigo-700"
                      >
                        Confirm
                      </button>}

                      {(booking.status === "Pending" || booking.status === "Confirmed") && <button
                        type="button"
                        onClick={() =>
                          void onStatusChange(booking.id, "complete")
                        }
                        className="rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 ease-in-out hover:bg-emerald-500"
                      >
                        Complete
                      </button>}

                      {(booking.status === "Pending" || booking.status === "Confirmed") && <button
                        type="button"
                        onClick={() => void onStatusChange(booking.id, "mark-no-show")}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition-all duration-200 ease-in-out hover:bg-amber-100"
                      >
                        No-show
                      </button>}

                      {(booking.status === "Pending" || booking.status === "Confirmed") && <button
                        type="button"
                        onClick={() => void onCancelBooking(booking.id)}
                        className="rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 ease-in-out hover:bg-rose-500"
                      >
                        Cancel
                      </button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500"><span>{selectedIds.length ? `${selectedIds.length} selected · ` : ""}Showing {filteredBookings.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredBookings.length)} of {filteredBookings.length}</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="min-h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-700 disabled:opacity-40">Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="min-h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-700 disabled:opacity-40">Next</button></div></div>

      {selectedBooking && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBooking(null); }}>
        <aside role="dialog" aria-modal="true" aria-labelledby="booking-detail-title" className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl animate-[soft-enter_180ms_ease-out]">
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur-xl">
            <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-indigo-600">Booking details · #{selectedBooking.id}</p><h2 id="booking-detail-title" className="mt-2 text-2xl font-semibold text-slate-950">{selectedBooking.customerName}</h2><p className="mt-1 text-sm text-slate-500">{selectedBooking.serviceName}</p></div>
            <button ref={closeDrawerRef} type="button" onClick={() => setSelectedBooking(null)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Close booking details"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${getStatusClasses(selectedBooking.status)}`}>{selectedBooking.status}</span><span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${getRiskClasses(selectedBooking.noShowProbability)}`}>No-show risk {typeof selectedBooking.noShowProbability === "number" ? `${(selectedBooking.noShowProbability * 100).toFixed(0)}%` : "N/A"}</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs font-medium text-slate-500">Service</p><p className="mt-2 font-semibold text-slate-900">{selectedBooking.serviceName}</p><p className="mt-1 text-sm text-slate-500">${selectedBooking.price.toFixed(2)} · {selectedBooking.durationInMinutes} min</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs font-medium text-slate-500">Assigned staff</p><p className="mt-2 font-semibold text-slate-900">{selectedBooking.staffName}</p><p className="mt-1 text-sm text-slate-500">Staff ID {selectedBooking.staffId}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:col-span-2"><p className="flex items-center gap-2 text-xs font-medium text-slate-500"><CalendarDays className="h-4 w-4" />Appointment time</p><p className="mt-2 flex items-center gap-2 font-semibold text-slate-900"><Clock3 className="h-4 w-4 text-indigo-600" />{formatDateTime(selectedBooking.dateTime)}</p></div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:col-span-2"><p className="text-xs font-semibold text-indigo-800">Customer record</p><p className="mt-1 text-sm leading-6 text-slate-600">Customer #{selectedBooking.customerId}. Booking history details are not included in this dashboard record.</p></div>
            </div>
            <div className="border-t border-slate-200 pt-5"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Quick actions</p><div className="flex flex-wrap gap-2">
              {selectedBooking.status === "Pending" && <button type="button" onClick={() => void onStatusChange(selectedBooking.id, "confirm")} className="min-h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">Confirm booking</button>}
              {(selectedBooking.status === "Pending" || selectedBooking.status === "Confirmed") && <button type="button" onClick={() => void onStatusChange(selectedBooking.id, "complete")} className="min-h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">Mark complete</button>}
              {(selectedBooking.status === "Pending" || selectedBooking.status === "Confirmed") && <button type="button" onClick={() => void onStatusChange(selectedBooking.id, "mark-no-show")} className="min-h-10 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 hover:bg-amber-100">Mark no-show</button>}
              {(selectedBooking.status === "Pending" || selectedBooking.status === "Confirmed") && <button type="button" onClick={() => void onCancelBooking(selectedBooking.id)} className="min-h-10 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100">Cancel booking</button>}
              <Link href={`/bookings/${selectedBooking.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Open full record</Link>
            </div></div>
          </div>
        </aside>
      </div>}
    </div>
  );
}

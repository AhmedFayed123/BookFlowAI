"use client";

import { useMemo, useState } from "react";
import type { BookingDetailDto } from "../../lib/api";

type BookingsTableProps = {
  bookings: BookingDetailDto[];
  onCancelBooking: (bookingId: number) => Promise<void> | void;
  onStatusChange: (
    bookingId: number,
    status: "confirm" | "complete" | "mark-no-show",
  ) => Promise<void> | void;
};

const getStatusClasses = (status: string) => {
  switch (status) {
    case "Pending":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "Confirmed":
      return "bg-blue-100 text-blue-700 ring-blue-200";
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

  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          booking.serviceName,
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

      return matchesSearch && matchesStatus;
    });
  }, [bookings, search, statusFilter]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-600">
            Live bookings
          </div>
          <h3 className="mt-2 text-xl font-bold text-slate-900">
            Bookings feed
          </h3>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search bookings"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-400 md:w-64"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-400"
          >
            <option value="All">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="NoShow">No Show</option>
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2 text-left">
          <thead>
            <tr className="text-xs uppercase tracking-[0.18em] text-slate-400">
              <th className="px-3 py-2 font-semibold">Customer</th>
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
                  colSpan={7}
                  className="px-3 py-8 text-center text-sm text-slate-500"
                >
                  No bookings match the current filters.
                </td>
              </tr>
            ) : (
              filteredBookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="rounded-2xl bg-slate-50 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all duration-300 animate-[fadeIn_0.35s_ease]"
                >
                  <td className="rounded-l-2xl px-3 py-3">
                    <div className="font-semibold text-slate-900">
                      {booking.staffName}
                    </div>
                    <div className="text-xs text-slate-500">#{booking.id}</div>
                  </td>

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
                      {booking.status}
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
                      <button
                        type="button"
                        onClick={() =>
                          void onStatusChange(booking.id, "confirm")
                        }
                        className="rounded-xl bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
                      >
                        Confirm
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void onStatusChange(booking.id, "complete")
                        }
                        className="rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                      >
                        Complete
                      </button>

                      <button
                        type="button"
                        onClick={() => void onCancelBooking(booking.id)}
                        className="rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

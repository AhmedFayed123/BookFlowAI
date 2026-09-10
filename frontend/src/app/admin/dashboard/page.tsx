"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  bookingsApi,
  type BookingDetailDto,
  type BookingStatusUpdate,
} from "../../../lib/api";
import { useSignalR } from "../../../hooks/useSignalR";
import DashboardSummaryCards from "../../../components/dashboard/DashboardSummaryCards";
import BookingsTable from "../../../components/dashboard/BookingsTable";
import AnalyticsPanel from "../../../components/dashboard/AnalyticsPanel";

const api = {
  bookings: {
    getAll: bookingsApi.getAll,
    cancel: bookingsApi.cancel,
    updateStatus: bookingsApi.updateStatus,
  },
};

const isNewBooking = (booking: BookingDetailDto) =>
  booking.status === "Pending" || booking.status === "Confirmed";

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<BookingDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  const summary = useMemo(() => {
    const today = new Date();
    const bookingsToday = bookings.filter(
      (booking) =>
        new Date(booking.dateTime).toDateString() === today.toDateString(),
    );

    const pendingRequests = bookings.filter(
      (booking) => booking.status === "Pending",
    ).length;
    const riskValues = bookings
      .map((booking) => booking.noShowProbability ?? 0)
      .filter((value) => value > 0);

    const averageNoShowRisk =
      riskValues.length > 0
        ? (riskValues.reduce((total, item) => total + item, 0) /
            riskValues.length) *
          100
        : 0;

    return {
      totalBookingsToday: bookingsToday.length,
      pendingRequests,
      averageNoShowRisk,
    };
  }, [bookings]);

  const playChime = () => {
    if (isMuted) return;

    if (typeof window === "undefined") return;

    const AudioCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;

    try {
      if (!audioRef.current) {
        audioRef.current = new AudioCtor();
      }

      const audioContext = audioRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(780, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.06,
        audioContext.currentTime + 0.02,
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.32,
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.35);
    } catch {
      // browser audio restrictions are acceptable to ignore
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadBookings = async () => {
      try {
        setLoading(true);
        const result = await api.bookings.getAll();
        if (!isMounted) return;
        setBookings(result);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadBookings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSignalRNewBooking = (payload: {
    bookingId?: number;
    serviceName?: string;
    status?: string;
    message?: string;
    customerId?: number;
    staffId?: number;
    noShowProbability?: number | null;
    dateTime?: string;
    staffName?: string;
  }) => {
    if (!payload?.bookingId) return;

    const incomingBooking: BookingDetailDto = {
      id: payload.bookingId,
      serviceId: 0,
      serviceName: payload.serviceName ?? "New Service",
      staffId: payload.staffId ?? 0,
      staffName: payload.staffName ?? "Assigned Staff",
      dateTime: payload.dateTime ?? new Date().toISOString(),
      durationInMinutes: 30,
      price: 0,
      status: (payload.status as BookingDetailDto["status"]) ?? "Pending",
      noShowProbability: payload.noShowProbability ?? 0,
    };

    setBookings((current) => [incomingBooking, ...current]);
    setNotice(payload.message ?? "A new booking has arrived.");
    playChime();
  };

  const { isConnected } = useSignalR({
    handlers: {
      ReceiveNewBooking: handleSignalRNewBooking,
      ReceiveBookingUpdate: (payload: BookingStatusUpdate) => {
        setBookings((current) =>
          current.map((booking) =>
            booking.id === payload.bookingId
              ? {
                  ...booking,
                  status: payload.status,
                }
              : booking,
          ),
        );
      },
      BookingStatusUpdated: (payload: BookingStatusUpdate) => {
        setBookings((current) =>
          current.map((booking) =>
            booking.id === payload.bookingId
              ? {
                  ...booking,
                  status: payload.status,
                }
              : booking,
          ),
        );
      },
    },
  });

  const handleCancelBooking = async (bookingId: number) => {
    try {
      await api.bookings.cancel(bookingId);
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId
            ? { ...booking, status: "Cancelled" }
            : booking,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not cancel booking.";
      setNotice(message);
    }
  };

  const handleStatusChange = async (
    bookingId: number,
    status: "confirm" | "complete" | "mark-no-show",
  ) => {
    try {
      await api.bookings.updateStatus(bookingId, status);
      setBookings((current) =>
        current.map((booking) => {
          if (booking.id !== bookingId) return booking;

          switch (status) {
            case "confirm":
              return { ...booking, status: "Confirmed" };
            case "complete":
              return { ...booking, status: "Completed" };
            case "mark-no-show":
              return { ...booking, status: "NoShow" };
            default:
              return booking;
          }
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not update booking status.";
      setNotice(message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600">
              Admin operations
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              Operations Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMuted((value) => !value)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              {isMuted ? "Enable chime" : "Mute chime"}
            </button>

            <div
              className={`rounded-full border px-3 py-2 text-sm font-semibold ${
                isConnected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {isConnected ? "Live" : "Offline"}
            </div>
          </div>
        </div>

        {notice && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
            {notice}
          </div>
        )}

        <DashboardSummaryCards
          totalBookingsToday={summary.totalBookingsToday}
          pendingRequests={summary.pendingRequests}
          averageNoShowRisk={summary.averageNoShowRisk}
        />

        <AnalyticsPanel />

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-1/3 rounded-full bg-slate-200" />
              <div className="h-12 w-full rounded-2xl bg-slate-200" />
              <div className="h-12 w-full rounded-2xl bg-slate-200" />
              <div className="h-12 w-full rounded-2xl bg-slate-200" />
            </div>
          </div>
        ) : (
          <BookingsTable
            bookings={bookings}
            onCancelBooking={handleCancelBooking}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </div>
  );
}

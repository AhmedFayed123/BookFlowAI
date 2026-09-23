"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bookingsApi,
  type AdminBookingDto,
  type BookingNotification,
  type BookingStatusUpdate,
} from "../../../lib/api";
import { useSignalR } from "../../../hooks/useSignalR";
import DashboardSummaryCards from "../../../components/dashboard/DashboardSummaryCards";
import BookingsTable from "../../../components/dashboard/BookingsTable";
import AnalyticsPanel from "../../../components/dashboard/AnalyticsPanel";
import OperationsSnapshot from "../../../components/dashboard/OperationsSnapshot";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import ConnectionStatusBadge from "../../../components/ui/ConnectionStatusBadge";
import { useToast } from "../../../components/ui/ToastProvider";
import WorkspaceShell from "../../../components/ui/WorkspaceShell";

const api = {
  bookings: {
    getAll: bookingsApi.getAll,
    cancel: bookingsApi.cancel,
    updateStatus: bookingsApi.updateStatus,
  },
};

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<AdminBookingDto[]>([]);
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
      confirmedToday: bookingsToday.filter((booking) => booking.status === "Confirmed").length,
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

  const loadBookings = useCallback(async (background = false) => {
    try {
      if (!background) setLoading(true);
      const result = await api.bookings.getAll();
      setBookings(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load the booking dashboard.";
      setNotice(message);
      if (!background) toast(message, "error");
    } finally {
      if (!background) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBookings(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBookings]);

  const handleSignalRNewBooking = (payload: BookingNotification) => {
    if (!payload?.bookingId) return;

    const incomingBooking: AdminBookingDto = {
      id: payload.bookingId,
      customerId: payload.customerId ?? 0,
      customerName: payload.customerName ?? "Customer",
      serviceId: payload.serviceId ?? 0,
      serviceName: payload.serviceName ?? "New Service",
      staffId: payload.staffId ?? 0,
      staffName: payload.staffName ?? "Assigned Staff",
      dateTime: payload.dateTime ?? new Date().toISOString(),
      durationInMinutes: payload.durationInMinutes ?? 0,
      price: payload.price ?? 0,
      status: payload.status ?? "Pending",
      noShowProbability: payload.noShowProbability ?? 0,
    };

    setBookings((current) => current.some((booking) => booking.id === incomingBooking.id) ? current : [incomingBooking, ...current]);
    setNotice(payload.message ?? "A new booking has arrived.");
    playChime();
  };

  const { connectionStatus, reconnect } = useSignalR({
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

  useEffect(() => {
    if (connectionStatus === "connected") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadBookings(true);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [connectionStatus, loadBookings]);

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
      toast("Booking cancelled.", "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not cancel booking.";
      setNotice(message);
      toast(message, "error");
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
      toast("Booking status updated.", "success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not update booking status.";
      setNotice(message);
      toast(message, "error");
    }
  };

  return (
    <ProtectedRoute requiredRole="Admin">
      <WorkspaceShell role="Admin" pendingBookingCount={summary.pendingRequests} eyebrow="Admin operations" title="Operations dashboard" description="Monitor demand, booking health, and team activity from one live command center." actions={<>
            <Link href="/admin/staff" className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              Manage staff
            </Link>
            <button
              type="button"
              onClick={() => setIsMuted((value) => !value)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              {isMuted ? "Enable chime" : "Mute chime"}
            </button>

            <ConnectionStatusBadge status={connectionStatus} onRetry={() => void reconnect()} />
          </>}>

        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        <section aria-label="Operational metrics" className="space-y-3">
          <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-indigo-700">Command center</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Today's operating pulse</h2></div><span className="hidden text-xs text-slate-500 sm:block">Live booking activity and business trends</span></div>
          <DashboardSummaryCards
            totalBookingsToday={summary.totalBookingsToday}
            confirmedToday={summary.confirmedToday}
            pendingRequests={summary.pendingRequests}
            averageNoShowRisk={summary.averageNoShowRisk}
          />
        </section>

        <section aria-label="Live operations and analytics" className="grid items-start gap-5 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2"><AnalyticsPanel /></div>
          <div className="min-w-0"><OperationsSnapshot /></div>
        </section>

        <section id="booking-feed" aria-label="Booking management" className="scroll-mt-24 space-y-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-indigo-700">Data management</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Booking desk</h2></div>
        {loading ? (
          <div className="surface-card rounded-2xl p-8 shadow-sm">
            <div className="skeleton-shimmer space-y-4">
              <div className="h-6 w-1/3 rounded-full bg-slate-200" />
              <div className="h-12 w-full rounded-xl bg-slate-200" />
              <div className="h-12 w-full rounded-xl bg-slate-200" />
              <div className="h-12 w-full rounded-xl bg-slate-200" />
            </div>
          </div>
        ) : (
          <BookingsTable
            bookings={bookings}
            onCancelBooking={handleCancelBooking}
            onStatusChange={handleStatusChange}
          />
        )}
        </section>
      </WorkspaceShell>
    </ProtectedRoute>
  );
}

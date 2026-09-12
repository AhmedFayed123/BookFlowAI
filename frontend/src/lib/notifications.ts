import type { BookingDetailDto } from "./api";

export type NotificationKind = "reminder" | "booking" | "system";
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: string;
  bookingId?: number;
  appointmentAt?: string;
  read?: boolean;
  dismissed?: boolean;
}
export const NOTIFICATION_EVENT = "bookflow:notification";
export const BOOKINGS_CHANGED_EVENT = "bookflow:bookings-changed";

export function publishNotification(notification: AppNotification) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: notification }));
}

export function appointmentLabel(value: string, now = new Date()) {
  // The backend currently returns business-local, offset-less schedule times.
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Appointment time unavailable";
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const sameDay = (other: Date) => date.toDateString() === other.toDateString();
  const day = sameDay(now) ? "Today" : sameDay(tomorrow) ? "Tomorrow" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day} at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function bookingReminders(bookings: Pick<BookingDetailDto, "id" | "dateTime" | "serviceName" | "status">[], now = new Date()): AppNotification[] {
  return bookings.filter((booking) => {
    const remaining = new Date(booking.dateTime).getTime() - now.getTime();
    return ["Pending", "Confirmed"].includes(booking.status) && remaining > 0 && remaining <= 48 * 60 * 60 * 1000;
  }).map((booking) => ({
    id: `reminder:${booking.id}:${booking.dateTime}`,
    kind: "reminder", title: "Your appointment is coming up",
    message: `${booking.serviceName} · ${appointmentLabel(booking.dateTime, now)}`,
    createdAt: now.toISOString(), bookingId: booking.id, appointmentAt: booking.dateTime,
  }));
}

export function relativeTime(value: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000));
  if (!Number.isFinite(minutes)) return "Recently";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

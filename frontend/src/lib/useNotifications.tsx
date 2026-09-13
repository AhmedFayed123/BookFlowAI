"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { authStorage, bookingsApi, staffApi, type UserRole } from "./api";
import { useToast } from "../components/ui/ToastProvider";
import { toLocalDateInputValue } from "./booking";
import { useSignalR } from "../hooks/useSignalR";
import { bookingReminders, BOOKINGS_CHANGED_EVENT, NOTIFICATION_EVENT, type AppNotification } from "./notifications";

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
}
const NotificationsContext = createContext<NotificationState | null>(null);

export function NotificationsProvider({ children, mockNotifications }: { children: ReactNode; mockNotifications?: AppNotification[] }) {
  const pathname = usePathname();
  const { toast } = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [listenForPayments, setListenForPayments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<AppNotification[]>([]);
  const owner = useRef<{ key: string; role: UserRole } | null>(null);
  const busy = useRef<string | null>(null);

  const commit = useCallback((next: AppNotification[]) => {
    itemsRef.current = next.slice(0, 200);
    setItems(itemsRef.current);
    if (owner.current) {
      try { window.localStorage.setItem(owner.current.key, JSON.stringify(itemsRef.current)); } catch { /* Private browsing must not disable notifications. */ }
    }
  }, []);

  const refresh = useCallback(async () => {
    const account = owner.current;
    if (!account || mockNotifications || busy.current === account.key) return;
    busy.current = account.key;
    setLoading(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const bookings = account.role === "Admin" ? await bookingsApi.getAll() : account.role === "Staff"
        ? (await Promise.all([staffApi.getMyBookings(), staffApi.getMyBookings(toLocalDateInputValue(tomorrow))])).flat()
        : await bookingsApi.getMyBookings();
      if (owner.current?.key !== account.key) return;
      const reminders = bookingReminders(bookings);
      const existing = new Map(itemsRef.current.map((item) => [item.id, item]));
      const merged = reminders.map((item) => {
        const prior = existing.get(item.id);
        return { ...item, createdAt: prior?.createdAt ?? item.createdAt, read: prior?.read, dismissed: prior?.dismissed };
      });
      const paymentUpdates: AppNotification[] = account.role === "Customer" ? bookings.filter((booking) =>
        "paymentStatus" in booking && ["Confirmed", "Rejected"].includes(String(booking.paymentStatus))
      ).map((booking) => ({
        id: `instapay:${booking.id}:${"paymentStatus" in booking ? booking.paymentStatus : ""}`,
        kind: "booking" as const, title: booking.status === "Cancelled" ? "InstaPay payment not confirmed" : "InstaPay payment approved",
        message: booking.status === "Cancelled" ? "Your hold was released. Contact support about your transfer." : `${booking.serviceName}: your InstaPay payment and booking are confirmed.`,
        bookingId: booking.id, createdAt: new Date().toISOString(),
      })).filter((item) => !existing.has(item.id)) : [];
      commit([...paymentUpdates, ...merged, ...itemsRef.current.filter((item) => item.kind !== "reminder")]);
      paymentUpdates.forEach((item) => toast(item.message, item.title.includes("approved") ? "success" : "warning"));
      setError(null);
      const unreadNew = merged.filter((item) => !existing.has(item.id) && !item.read && !item.dismissed);
      if (unreadNew.length) toast(unreadNew.length === 1 ? unreadNew[0].message : `You have ${unreadNew.length} upcoming appointments.`, "info");
    } catch (caught) {
      if (owner.current?.key === account.key) setError(caught instanceof Error ? caught.message : "Reminders could not be refreshed. Please try again.");
    } finally {
      if (busy.current === account.key) busy.current = null;
      if (owner.current?.key === account.key) setLoading(false);
    }
  }, [commit, mockNotifications, toast]);

  useEffect(() => {
    const syncAccount = () => {
      let account: { email?: string; role?: UserRole } | null = null;
      try { account = JSON.parse(window.localStorage.getItem("bookflow_user") ?? "null"); } catch { /* Invalid local profile. */ }
      const role = account?.role;
      const key = mockNotifications ? "bookflow:notifications:mock" : authStorage.hasActiveSession() && account?.email && role && ["Customer", "Staff", "Admin"].includes(role) ? `bookflow:notifications:${account.email.toLowerCase()}` : null;
      if (owner.current?.key === key) return;
      owner.current = key ? { key, role: role ?? "Customer" } : null;
      setListenForPayments(Boolean(key && role === "Customer" && !mockNotifications));
      itemsRef.current = [];
      let stored: AppNotification[] = mockNotifications ?? [];
      if (key && !mockNotifications) {
        try {
          const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
          if (Array.isArray(parsed)) stored = parsed.filter((item): item is AppNotification => item && typeof item.id === "string" && typeof item.message === "string" && typeof item.title === "string" && typeof item.createdAt === "string" && ["reminder", "booking", "system"].includes(item.kind));
        } catch { /* Start with a clean list, never fake live appointments. */ }
      }
      setError(null); setLoading(false); commit(stored);
      void refresh();
    };
    const receive = (event: Event) => {
      syncAccount();
      if (!owner.current) return;
      const notification = (event as CustomEvent<AppNotification>).detail;
      if (!notification?.id || itemsRef.current.some((item) => item.id === notification.id)) return;
      commit([notification, ...itemsRef.current]);
    };
    const updateBookings = () => { syncAccount(); void refresh(); };
    const timer = window.setTimeout(syncAccount, 0);
    const poll = window.setInterval(updateBookings, 60000);
    window.addEventListener("storage", syncAccount);
    window.addEventListener("bookflow:profile-updated", syncAccount);
    window.addEventListener(NOTIFICATION_EVENT, receive);
    window.addEventListener(BOOKINGS_CHANGED_EVENT, updateBookings);
    window.addEventListener("focus", updateBookings);
    return () => {
      window.clearTimeout(timer); window.clearInterval(poll);
      window.removeEventListener("storage", syncAccount);
      window.removeEventListener("bookflow:profile-updated", syncAccount);
      window.removeEventListener(NOTIFICATION_EVENT, receive);
      window.removeEventListener(BOOKINGS_CHANGED_EVENT, updateBookings);
      window.removeEventListener("focus", updateBookings);
      owner.current = null;
    };
  }, [pathname, commit, refresh, mockNotifications]);

  useSignalR({ autoStart: listenForPayments, handlers: { ReceiveBookingUpdate: () => { void refresh(); window.dispatchEvent(new Event(BOOKINGS_CHANGED_EVENT)); } } });

  const notifications = items.filter((item) => !item.dismissed).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <NotificationsContext.Provider value={{ notifications, unreadCount: notifications.filter((item) => !item.read).length, loading, error, refresh,
    markRead: (id) => commit(itemsRef.current.map((item) => item.id === id ? { ...item, read: true } : item)),
    markAllRead: () => commit(itemsRef.current.map((item) => ({ ...item, read: true }))),
    dismiss: (id) => commit(itemsRef.current.map((item) => item.id === id ? { ...item, dismissed: true } : item)),
  }}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationsProvider");
  return context;
}

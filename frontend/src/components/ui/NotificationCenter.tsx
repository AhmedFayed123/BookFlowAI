"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, CalendarDays, Check, CheckCheck, CheckCircle2, Clock3, RefreshCw, ArrowUpRight, X } from "lucide-react";
import { useNotifications } from "../../lib/useNotifications";
import { appointmentLabel, relativeTime } from "../../lib/notifications";

export default function NotificationCenter() {
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = () => { setOpen(false); trigger.current?.focus(); };
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const elements = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
        if (!elements?.length) return;
        const first = elements[0]; const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard); };
  }, [open]);

  const groups = [
    { label: "Reminders", items: notifications.filter((item) => item.kind === "reminder") },
    { label: "Today", items: notifications.filter((item) => item.kind !== "reminder" && new Date(item.createdAt).toDateString() === new Date().toDateString()) },
    { label: "Earlier", items: notifications.filter((item) => item.kind !== "reminder" && new Date(item.createdAt).toDateString() !== new Date().toDateString()) },
  ];

  return <div ref={root} className="relative shrink-0">
    <button ref={trigger} type="button" onClick={() => { setOpen(!open); if (!open) void refresh(); }} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} aria-haspopup="dialog" aria-controls={panelId} className={`relative grid h-10 w-10 place-items-center rounded-xl border transition-all ${open ? "border-slate-300 bg-slate-100 text-slate-900" : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
      <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
      {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full border-2 border-white bg-amber-600 px-1 text-[10px] font-semibold leading-4 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <div ref={panel} id={panelId} role="dialog" aria-label="Notification center" className="soft-enter fixed left-3 right-3 top-24 z-50 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-900/15 backdrop-blur-md lg:absolute lg:left-auto lg:right-0 lg:top-14 lg:w-[420px]">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
        <div><h2 className="text-base font-bold text-slate-900">Notifications</h2><p className="mt-0.5 text-xs text-slate-500">{unreadCount ? `${unreadCount} unread · Stay one step ahead` : "Your appointments, at a glance"}</p></div>
        <button type="button" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </header>
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-2.5">
        <button type="button" disabled={!unreadCount} onClick={markAllRead} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40"><CheckCheck className="h-3.5 w-3.5" />Mark all as read</button>
        <button type="button" disabled={loading} onClick={() => void refresh()} aria-label="Refresh notifications" className="rounded-lg p-1.5 text-slate-500 hover:bg-white disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      <div className="max-h-[min(32rem,calc(100dvh-14rem))] overflow-y-auto overscroll-contain p-3">
        {error && <div role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{error}<button type="button" onClick={() => void refresh()} disabled={loading} className="ml-2 inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="h-3 w-3" />Try again</button></div>}
        {loading && !notifications.length ? <div role="status" aria-label="Loading notifications" className="space-y-3 p-2">{[1, 2, 3].map((id) => <div key={id} className="skeleton-shimmer h-24 rounded-xl bg-slate-100" />)}</div> : !notifications.length ? <div className="px-6 py-10 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400"><BellRing className="h-6 w-6" /></span><h3 className="mt-4 text-sm font-semibold">You’re all caught up</h3><p className="mt-2 text-xs leading-5 text-slate-500">Upcoming appointments and booking updates will appear here.</p></div> : groups.map((group) => group.items.length > 0 && <section key={group.label} aria-label={group.label} className="mb-3 last:mb-0">
          <h3 className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</h3>
          <div className="space-y-2">{group.items.map((item) => {
            const Icon = item.kind === "reminder" ? Clock3 : item.kind === "booking" ? CheckCircle2 : Bell;
            return <article key={item.id} className={`group rounded-xl border p-3.5 transition-colors hover:border-slate-300 ${item.read ? "border-transparent bg-slate-50/60" : "border-slate-200 bg-white shadow-sm"}`}>
              <div className="flex items-start gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.kind === "reminder" ? "bg-amber-50 text-amber-700" : item.kind === "booking" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1"><h4 className="text-sm font-semibold leading-5 text-slate-900">{item.title}{!item.read && <span aria-label="Unread" className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-600" />}</h4><p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.message}</p><p className="mt-1.5 text-[11px] text-slate-400">{item.appointmentAt ? appointmentLabel(item.appointmentAt) : relativeTime(item.createdAt)}</p></div>
                <button type="button" aria-label={`Dismiss: ${item.title}`} onClick={() => dismiss(item.id)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 pl-11">
                {item.bookingId && <Link href={`/bookings/${item.bookingId}`} onClick={() => { markRead(item.id); setOpen(false); }} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"><CalendarDays className="h-3.5 w-3.5" />View booking<ArrowUpRight className="h-3 w-3" /></Link>}
                {!item.read && <button type="button" onClick={() => markRead(item.id)} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900"><Check className="h-3 w-3" />Mark as read</button>}
              </div>
            </article>;
          })}</div>
        </section>)}
      </div>
      <footer className="border-t border-slate-200/70 bg-slate-50/70 px-5 py-3 text-[10px] leading-4 text-slate-500">In-app reminders refresh every minute while BookFlow is open. Times follow your local schedule.</footer>
    </div>}
  </div>;
}

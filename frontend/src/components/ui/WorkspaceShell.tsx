"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenText,
  Layers3,
  SlidersHorizontal,
  CalendarDays,
  Home,
  LogOut,
  UserRound,
  UsersRound,
  Search,
  Plus,
  PanelLeftClose,
} from "lucide-react";
import { useEffect, useState } from "react";
import { endSession, type UserRole } from "../../lib/api";
import { useToast } from "./ToastProvider";
import AccountBadge from "./AccountBadge";
import NotificationCenter from "./NotificationCenter";

const navigation: Record<
  UserRole,
  Array<{ href: string; label: string; icon: typeof Home }>
> = {
  Customer: [
    { href: "/protected", label: "My bookings", icon: CalendarDays },
    { href: "/account", label: "Account", icon: UserRound },
  ],
  Staff: [
    { href: "/staff", label: "Schedule", icon: CalendarDays },
    { href: "/account", label: "Account", icon: UserRound },
  ],
  Admin: [
    { href: "/admin/dashboard", label: "Operations", icon: CalendarDays },
    { href: "/admin/instapay", label: "InstaPay payments", icon: BookOpenText },
    { href: "/admin/staff", label: "Team", icon: UsersRound },
    { href: "/admin/knowledge", label: "Knowledge", icon: BookOpenText },
    { href: "/admin/catalog", label: "Catalog", icon: Layers3 },
    { href: "/admin/business", label: "Business & AI", icon: SlidersHorizontal },
    { href: "/account", label: "Account", icon: UserRound },
  ],
};

export default function WorkspaceShell({
  role,
  eyebrow,
  title,
  description,
  actions,
  pendingBookingCount,
  children,
}: {
  role: UserRole;
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  pendingBookingCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState<string>(role);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const syncUser = () => {
      try {
        const value = window.localStorage.getItem("bookflow_user");
        const user = value ? (JSON.parse(value) as { name?: string }) : null;
        if (user?.name) setName(user.name);
      } catch {
        /* corrupted display preferences should not block the workspace */
      }
    };
    const timer = window.setTimeout(syncUser, 0);
    window.addEventListener("storage", syncUser);
    window.addEventListener("bookflow:profile-updated", syncUser);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", syncUser); window.removeEventListener("bookflow:profile-updated", syncUser); };
  }, []);

  useEffect(() => {
    if (role !== "Admin") return;
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("admin-global-search")?.focus();
      }
    };
    document.addEventListener("keydown", openSearch);
    return () => document.removeEventListener("keydown", openSearch);
  }, [role]);

  const signOut = async () => {
    setSigningOut(true);
    try { await endSession(); }
    catch { toast("Signed out locally. Server session revocation could not be confirmed.", "warning"); }
    finally { router.replace("/"); }
  };

  return (
    <div className={`hero-canvas min-h-screen bg-background text-slate-950 ${role === "Admin" ? "lg:flex" : ""}`}>
      {role === "Admin" && <aside className={`hidden shrink-0 flex-col border-r border-slate-200/80 bg-white/85 px-3 py-5 backdrop-blur-xl transition-all duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen ${sidebarCollapsed ? "lg:w-[76px]" : "lg:w-[256px]"}`}>
        <Link href="/" className={`mb-8 flex items-center gap-3 px-2 ${sidebarCollapsed ? "justify-center" : ""}`} aria-label="BookFlow AI home">
          <Image src="/logo.svg" alt="" width={36} height={36} />
          {!sidebarCollapsed && <span className="font-bold tracking-tight text-slate-950">BookFlow <span className="font-normal text-indigo-600">AI</span></span>}
        </Link>
        {!sidebarCollapsed && <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Operations</div>}
        <nav className="space-y-1" aria-label="Admin operations">
          {navigation.Admin.slice(0, 2).map((item) => { const Icon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} title={sidebarCollapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all ${active ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon className="h-4 w-4 shrink-0" />{!sidebarCollapsed && item.label}</Link>; })}
        </nav>
        {!sidebarCollapsed && <div className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Management</div>}
        <nav className="space-y-1" aria-label="Admin management">
          {navigation.Admin.slice(2, 5).map((item) => { const Icon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} title={sidebarCollapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all ${active ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon className="h-4 w-4 shrink-0" />{!sidebarCollapsed && item.label}</Link>; })}
        </nav>
        {!sidebarCollapsed && <div className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">System</div>}
        <nav className="space-y-1" aria-label="Admin system">
          {navigation.Admin.slice(5).map((item) => { const Icon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} title={sidebarCollapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all ${active ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon className="h-4 w-4 shrink-0" />{!sidebarCollapsed && item.label}</Link>; })}
        </nav>
        <div className="mt-auto">
          {!sidebarCollapsed && <div className="mb-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-3"><p className="text-xs font-semibold text-slate-800">BookFlow workspace</p><p className="mt-1 text-[11px] text-slate-500">Administrative console</p></div>}
          <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}><PanelLeftClose className={`h-4 w-4 ${sidebarCollapsed ? "rotate-180" : ""}`} />{!sidebarCollapsed && "Collapse navigation"}</button>
          {!sidebarCollapsed && <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{name}</p><p className="text-[11px] text-slate-500">Administrator</p></div><span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" aria-label="Active" /></div>}
        </div>
      </aside>}
      <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className={`mr-auto items-center gap-2.5 ${role === "Admin" ? "hidden" : "flex"}`}
            aria-label="BookFlow AI home"
          >
            <Image src="/logo.svg" alt="" width={36} height={36} />
            <span className="hidden font-bold tracking-tight text-slate-950 sm:block">
              BookFlow AI
            </span>
          </Link>
          {role === "Admin" && <form className="relative hidden min-w-48 max-w-xl flex-1 md:block" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.querySelector<HTMLInputElement>("input"); window.dispatchEvent(new CustomEvent("bookflow:admin-search", { detail: { query: input?.value ?? "" } })); document.getElementById("booking-feed")?.scrollIntoView({ behavior: "smooth" }); }}><label htmlFor="admin-global-search" className="sr-only">Search bookings, customers, or staff</label><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="admin-global-search" type="search" placeholder="Search bookings, customers, staff" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-16 text-sm outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" /><kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500">Ctrl K</kbd></form>}
          {role === "Admin" && <Link href="/admin/catalog" className="hidden min-h-10 items-center gap-2 rounded-xl button-primary px-3 text-sm font-semibold text-white sm:inline-flex"><Plus className="h-4 w-4" />Add service</Link>}
          {role === "Admin" && pendingBookingCount !== undefined && <Link href="#booking-feed" className="hidden min-h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900 lg:inline-flex"><span className="h-2 w-2 rounded-full bg-amber-500" />{pendingBookingCount} pending</Link>}
          <nav
            className={`min-w-0 items-center gap-1 overflow-x-auto ${role === "Admin" ? "flex lg:hidden" : "flex flex-1"}`}
            aria-label="Workspace navigation"
          >
            {navigation[role].map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ease-in-out ${active ? "border border-indigo-100 bg-indigo-50 text-indigo-800 shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <NotificationCenter />
          <div className="hidden shrink-0 md:block"><AccountBadge name={name === role ? undefined : name} role={role} /></div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-all duration-200 ease-in-out hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
        <div className="border-t border-slate-200/60 px-4 py-2 md:hidden"><AccountBadge name={name === role ? undefined : name} role={role} /></div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="surface-card flex flex-col gap-5 rounded-2xl p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {description}
            </p>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </section>
        {children}
      </main>
      </div>
    </div>
  );
}

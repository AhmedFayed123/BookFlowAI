"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenText, CalendarDays, Layers3, LayoutDashboard, LogOut, Menu, SlidersHorizontal, UserRound, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { endSession, type UserRole } from "../../lib/api";
import { useToast } from "./ToastProvider";
import AccountBadge from "./AccountBadge";
import NotificationCenter from "./NotificationCenter";

const navigation: Record<UserRole, Array<{ href: string; label: string; icon: typeof LayoutDashboard }>> = {
  Customer: [{ href: "/protected", label: "Overview", icon: LayoutDashboard }, { href: "/account", label: "Account", icon: UserRound }],
  Staff: [{ href: "/staff", label: "Schedule", icon: CalendarDays }, { href: "/account", label: "Account", icon: UserRound }],
  Admin: [{ href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard }, { href: "/admin/instapay", label: "Payments", icon: BookOpenText }, { href: "/admin/staff", label: "Team", icon: UsersRound }, { href: "/admin/knowledge", label: "Knowledge", icon: BookOpenText }, { href: "/admin/catalog", label: "Catalog", icon: Layers3 }, { href: "/admin/business", label: "Business & AI", icon: SlidersHorizontal }, { href: "/account", label: "Account", icon: UserRound }],
};

export default function WorkspaceShell({ role, eyebrow, title, description, actions, children }: { role: UserRole; eyebrow: string; title: string; description: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const [name, setName] = useState<string>(role); const [signingOut, setSigningOut] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const { toast } = useToast();
  useEffect(() => { const syncUser = () => { try { const value = window.localStorage.getItem("bookflow_user"); const user = value ? (JSON.parse(value) as { name?: string }) : null; if (user?.name) setName(user.name); } catch { /* display-only preference */ } }; syncUser(); window.addEventListener("storage", syncUser); window.addEventListener("bookflow:profile-updated", syncUser); return () => { window.removeEventListener("storage", syncUser); window.removeEventListener("bookflow:profile-updated", syncUser); }; }, []);
  const signOut = async () => { setSigningOut(true); try { await endSession(); } catch { toast("Signed out locally. Server session revocation could not be confirmed.", "warning"); } finally { router.replace("/"); } };
  const links = navigation[role];
  return <div className="min-h-screen bg-[#f6f7fb] text-slate-950">
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white px-4 py-5 transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between px-2"><Link href="/" className="flex items-center gap-3"><Image src="/logo.svg" alt="" width={34} height={34} /><span className="font-bold tracking-tight">BookFlow <span className="font-normal text-slate-400">AI</span></span></Link><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></button></div>
      <div className="mt-8 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-indigo-600">Workspace</p><p className="mt-1 text-sm font-semibold text-slate-900">{role} portal</p></div>
      <nav className="mt-7 flex flex-1 flex-col gap-1" aria-label="Workspace navigation">{links.map(({ href, label, icon: Icon }) => { const active = pathname === href; return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon className="h-4 w-4" />{label}</Link>; })}</nav>
      <div className="border-t border-slate-100 pt-4"><AccountBadge name={name === role ? undefined : name} role={role} /><button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700"><LogOut className="h-4 w-4" />{signingOut ? "Signing out..." : "Sign out"}</button></div>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-40 bg-slate-950/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}
    <div className="lg:pl-72"><header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl"><div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"><button className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></button><div className="ml-auto flex items-center gap-2"><NotificationCenter /><Link href="/" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 sm:block">View site</Link></div></div></header>
      <main className="mx-auto max-w-[1440px] space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600">{eyebrow}</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">{description}</p></div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</section>{children}</main>
    </div>
  </div>;
}

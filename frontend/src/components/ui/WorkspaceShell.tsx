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
  children,
}: {
  role: UserRole;
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState<string>(role);
  const [signingOut, setSigningOut] = useState(false);
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

  const signOut = async () => {
    setSigningOut(true);
    try { await endSession(); }
    catch { toast("Signed out locally. Server session revocation could not be confirmed.", "warning"); }
    finally { router.replace("/"); }
  };

  return (
    <div className="hero-canvas min-h-screen bg-background text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mr-auto flex items-center gap-2.5"
            aria-label="BookFlow AI home"
          >
            <Image src="/logo.svg" alt="" width={36} height={36} />
            <span className="hidden font-bold tracking-tight text-slate-950 sm:block">
              BookFlow AI
            </span>
          </Link>
          <nav
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
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
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ease-in-out ${active ? "border border-slate-200 bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
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
  );
}

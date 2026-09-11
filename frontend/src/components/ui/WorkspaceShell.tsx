"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenText,
  CalendarDays,
  Home,
  LogOut,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { authStorage, type UserRole } from "../../lib/api";

const navigation: Record<
  UserRole,
  Array<{ href: string; label: string; icon: typeof Home }>
> = {
  Customer: [{ href: "/protected", label: "My bookings", icon: CalendarDays }],
  Staff: [{ href: "/staff", label: "Schedule", icon: CalendarDays }],
  Admin: [
    { href: "/admin/dashboard", label: "Operations", icon: CalendarDays },
    { href: "/admin/staff", label: "Team", icon: UsersRound },
    { href: "/admin/knowledge", label: "Knowledge", icon: BookOpenText },
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

  useEffect(() => {
    try {
      const value = window.localStorage.getItem("bookflow_user");
      const user = value ? (JSON.parse(value) as { name?: string }) : null;
      if (user?.name) setName(user.name);
    } catch {
      /* corrupted display preferences should not block the workspace */
    }
  }, []);

  const signOut = () => {
    authStorage.clear();
    window.localStorage.removeItem("bookflow_user");
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mr-auto flex items-center gap-2.5"
            aria-label="BookFlow AI home"
          >
            <Image src="/logo.svg" alt="" width={36} height={36} />
            <span className="hidden font-black tracking-tight text-slate-950 sm:block">
              BookFlow AI
            </span>
          </Link>
          <nav
            className="flex items-center gap-1"
            aria-label="Workspace navigation"
          >
            {navigation[role].map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="hidden text-right md:block">
            <p className="max-w-36 truncate text-sm font-bold text-slate-800">
              {name}
            </p>
            <p className="text-xs text-slate-400">{role}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="flex flex-col gap-5 rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl shadow-slate-200 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
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

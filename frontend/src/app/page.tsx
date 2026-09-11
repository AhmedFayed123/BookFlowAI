"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AiChatWidget from "../components/chat/AiChatWidget";
import ServiceList from "../components/booking/ServiceList";
import { authStorage } from "../lib/api";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("bookflow_user");
        setUser(raw ? JSON.parse(raw) : null);
      } catch { setUser(null); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const roleLabel = useMemo(() => user?.role || "Guest", [user]);

  const handleLogout = () => {
    authStorage.clear();
    window.localStorage.removeItem("bookflow_user");
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600">
              BookFlowAI
            </p>
            <h1 className="mt-1 text-xl font-black">
              AI-powered booking platform
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
              {roleLabel}
            </div>

            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Logout
              </button>
            ) : (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Dynamic service operations
            </div>

            <h2 className="mt-6 max-w-xl text-5xl font-black leading-tight text-slate-900">
              One booking platform for every service industry
            </h2>
            <p className="mt-5 max-w-2xl text-lg text-slate-600">
              Configure categories, services, providers, and schedules for
              clinics, wellness teams, coaches, auto-care centers, consultants,
              and any appointment-based business.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#services"
                className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
              >
                Book an Appointment
              </a>
              <Link
                href="/admin/dashboard"
                className="rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50"
              >
                Admin Dashboard
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Bookings", value: "24/7" },
                { label: "AI risk", value: "Low-Med-High" },
                { label: "Ops", value: "Live" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    {item.label}
                  </div>
                  <div className="mt-3 text-2xl font-black text-slate-900">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-100">
                Live AI signal
              </p>
              <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-50">
                Real-time
              </span>
            </div>

            <div className="mt-7 rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-violet-50">
                <span className="text-sm font-medium">No-show forecast</span>
                <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-xs font-semibold text-emerald-100">
                  Stable
                </span>
              </div>

              <div className="mt-5 flex items-end gap-3">
                <div className="text-5xl font-black">18%</div>
                <div className="pb-2 text-sm text-violet-100">risk score</div>
              </div>

              <div className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[18%] rounded-full bg-gradient-to-r from-emerald-300 via-yellow-300 to-amber-400" />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-950/10 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-violet-100">
                    Client profile
                  </div>
                  <div className="mt-2 text-lg font-bold">VIP Member</div>
                </div>
                <div className="rounded-2xl bg-slate-950/10 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-violet-100">
                    Confidence
                  </div>
                  <div className="mt-2 text-lg font-bold">92%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl px-6 pb-20">
        <ServiceList />
      </section>

      <AiChatWidget />
    </main>
  );
}

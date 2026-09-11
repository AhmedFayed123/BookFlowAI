"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Bot, CalendarCheck2, CheckCircle2, Clock3, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import AiChatWidget from "../components/chat/AiChatWidget";
import ServiceList from "../components/booking/ServiceList";
import { authStorage, type UserRole } from "../lib/api";

type StoredUser = { name?: string; role?: UserRole };

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("bookflow_user");
        setUser(raw ? JSON.parse(raw) as StoredUser : null);
      } catch { setUser(null); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const workspaceHref = user?.role === "Admin" ? "/admin/dashboard" : user?.role === "Staff" ? "/staff" : "/protected";
  const logout = () => {
    authStorage.clear();
    window.localStorage.removeItem("bookflow_user");
    router.push("/");
  };

  return <main className="min-h-screen overflow-hidden bg-slate-50 text-slate-950">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6" aria-label="Primary navigation">
        <Link href="/" className="flex items-center gap-3"><Image src="/logo.svg" alt="" width={40} height={40} priority /><div><span className="block text-sm font-black tracking-tight">BookFlow AI</span><span className="hidden text-xs text-slate-500 sm:block">Intelligent service booking</span></div></Link>
        <div className="flex items-center gap-2">
          {user ? <><Link href={workspaceHref} className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:block">My workspace</Link><span className="hidden max-w-36 truncate rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 md:block">{user.name || user.role}</span><button type="button" onClick={logout} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Sign out</button></>
            : <><Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Sign in</Link><Link href="/register" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-violet-700">Get started</Link></>}
        </div>
      </nav>
    </header>

    <section className="relative isolate">
      <div className="absolute inset-x-0 top-0 -z-10 h-[40rem] bg-[radial-gradient(circle_at_15%_25%,rgba(196,181,253,0.55),transparent_35%),radial-gradient(circle_at_85%_5%,rgba(165,180,252,0.5),transparent_32%)]" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-28">
        <div className="soft-enter">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-violet-700 shadow-sm"><Sparkles className="h-4 w-4" />One booking layer for every service business</div>
          <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-7xl">Make every appointment feel <span className="brand-gradient">effortless.</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">Discover services, compare verified providers, and reserve the right time—while teams manage schedules and customer flow in real time.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><a href="#services" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 font-bold text-white shadow-xl shadow-violet-200 transition hover:-translate-y-0.5 hover:brightness-110">Explore services <ArrowRight className="h-5 w-5" /></a>{!user && <Link href="/register" className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white/80 px-6 py-3.5 font-bold text-slate-800 transition hover:border-violet-300 hover:bg-white">Create a free account</Link>}</div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-600">{["Live availability", "Secure role-based access", "AI-assisted operations"].map((label) => <span key={label} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{label}</span>)}</div>
        </div>

        <div className="soft-enter relative mx-auto w-full max-w-xl rounded-[2.2rem] border border-white/70 bg-white/75 p-4 shadow-[0_35px_100px_rgba(79,70,229,0.18)] backdrop-blur-xl sm:p-6" style={{ animationDelay: "120ms" }}>
          <div className="rounded-[1.7rem] bg-slate-950 p-6 text-white">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Your booking journey</p><h2 className="mt-2 text-2xl font-black">Simple by design</h2></div><Bot className="h-9 w-9 text-violet-300" /></div>
            <div className="mt-7 space-y-3">{[
              { icon: Sparkles, title: "Choose a service", text: "Filter dynamically across any industry." },
              { icon: UsersRound, title: "Pick your provider", text: "Only qualified, available people appear." },
              { icon: CalendarCheck2, title: "Reserve a live slot", text: "See duration-aware availability instantly." },
            ].map((item, index) => <div key={item.title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-200"><item.icon className="h-5 w-5" /></span><div><div className="flex items-center gap-2 font-bold"><span className="text-xs text-violet-300">0{index + 1}</span>{item.title}</div><p className="mt-1 text-sm text-slate-300">{item.text}</p></div></div>)}</div>
          </div>
          <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:flex"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Clock3 className="h-5 w-5" /></span><div><p className="text-xs text-slate-500">Scheduling</p><p className="text-sm font-black text-slate-900">Real-time</p></div></div>
        </div>
      </div>
    </section>

    <section className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">{[
      { icon: CalendarCheck2, title: "Duration-aware slots", text: "Availability respects shifts, existing bookings, and service length." },
      { icon: ShieldCheck, title: "Reliable by default", text: "Protected workflows and clear feedback at every step." },
      { icon: Bot, title: "AI when it matters", text: "Practical forecasting and business-aware customer assistance." },
    ].map((item) => <div key={item.title} className="flex gap-4 p-3"><item.icon className="h-6 w-6 shrink-0 text-violet-600" /><div><h2 className="font-black text-slate-900">{item.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p></div></div>)}</div></section>

    <section id="services" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24"><ServiceList /></section>
    <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p>© {new Date().getFullYear()} BookFlow AI</p><p>Built for modern service teams.</p></div></footer>
    <AiChatWidget />
  </main>;
}

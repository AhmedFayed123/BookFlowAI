"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarCheck2, Clock3, UsersRound, Sparkles, LogOut, ArrowUpRight } from "lucide-react";
import AiChatWidget from "../components/chat/AiChatWidget";
import ServiceList from "../components/booking/ServiceList";
import BusinessInfo from "../components/booking/BusinessInfo";
import AccountBadge from "../components/ui/AccountBadge";
import { useToast } from "../components/ui/ToastProvider";
import { endSession, type UserRole } from "../lib/api";

type StoredUser = { name?: string; role?: UserRole };

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const syncUser = () => {
      try {
        const raw = window.localStorage.getItem("bookflow_user");
        setUser(raw ? JSON.parse(raw) as StoredUser : null);
      } catch { setUser(null); }
    };
    const timer = window.setTimeout(syncUser, 0);
    window.addEventListener("storage", syncUser);
    window.addEventListener("bookflow:profile-updated", syncUser);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", syncUser); window.removeEventListener("bookflow:profile-updated", syncUser); };
  }, []);

  const workspaceHref = user?.role === "Admin" ? "/admin/dashboard" : user?.role === "Staff" ? "/staff" : "/protected";
  const logout = async () => {
    setSigningOut(true);
    try { await endSession(); }
    catch { toast("Signed out locally. Server revocation could not be confirmed.", "warning"); }
    finally { setUser(null); setSigningOut(false); router.push("/"); }
  };

  return (
    <main className="min-h-screen bg-background text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
          <Link href="/" aria-label="BookFlow AI home" className="flex items-center gap-3">
            <Image src="/logo.svg" alt="" width={36} height={36} priority />
            <span className="hidden text-base font-bold tracking-tight min-[360px]:inline">BookFlow <span className="font-normal text-slate-500">AI</span></span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <a href="#services" className="hidden text-sm font-medium text-slate-600 hover:text-emerald-800 sm:block">Services</a>
            {user ? (
              <>
                <Link href={workspaceHref} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Workspace</Link>
                <button type="button" disabled={signingOut} onClick={() => void logout()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"><LogOut className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Sign out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Sign in</Link>
                <Link href="/register" className="rounded-lg button-primary px-3 py-2.5 text-sm font-semibold text-white hover:brightness-110 sm:px-4"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Get started</span><ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
              </>
            )}
          </div>
          {user && <div className="w-full border-t border-slate-200/70 pt-3 md:order-none md:w-auto md:border-0 md:pt-0"><AccountBadge name={user.name} role={user.role} /></div>}
        </nav>
      </header>

      <section className="hero-canvas mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
        <div className="soft-enter">
          <p className="section-kicker"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Thoughtfully simple. AI powered.</p>
          <h1 className="mt-5 max-w-xl text-4xl font-bold leading-[1.06] tracking-[-0.045em] sm:text-5xl lg:text-[4.25rem]">Your next appointment.<br /><span className="text-slate-500">Less back-and-forth.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">Find a service, choose the right person, and pick a time that works. A simpler way to make plans—and keep them.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="#services" className="inline-flex items-center justify-center gap-3 rounded-lg button-primary px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]">Find a service <ArrowRight className="h-4 w-4" /></a>
            <span className="text-sm text-slate-500">Your schedule. Your pace.</span>
          </div>
          <div className="mt-10 flex items-center gap-3 border-t border-slate-200 pt-5 text-sm text-slate-500"><Clock3 className="h-4 w-4 text-emerald-700" />Availability that fits real working hours.</div>
        </div>
        <aside id="booking-help" aria-label="Booking assistance" className="soft-enter min-w-0 rounded-[1.75rem] border border-white/80 bg-slate-200/35 p-2 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)] sm:p-3">
          <AiChatWidget />
        </aside>
      </section>

      <section className="border-y border-slate-200/80 bg-white" aria-label="How booking works">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            { icon: CalendarCheck2, title: "Find your service", text: "Compare options, prices, and duration." },
            { icon: UsersRound, title: "Choose your provider", text: "Match your needs with the right person." },
            { icon: Clock3, title: "Make time for it", text: "Choose an available slot and confirm." },
          ].map((item, index) => (
            <div key={item.title} className="flex items-start gap-4 rounded-xl px-2 py-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-500">0{index + 1}</span>
              <div><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><item.icon className="h-4 w-4 text-emerald-700" />{item.title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{item.text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><ServiceList /></section>
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8"><BusinessInfo /></div>
      <footer className="border-t border-slate-200/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-6 lg:px-8"><p>© {new Date().getFullYear()} BookFlow AI</p><p>A little less admin. A little more life.</p></div>
      </footer>
    </main>
  );
}

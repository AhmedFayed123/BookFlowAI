"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarCheck2, Clock3, HeartHandshake, LogOut, Search, ShieldCheck, Sparkles, UsersRound, Zap } from "lucide-react";
import AiChatWidget from "../components/chat/AiChatWidget";
import ServiceList from "../components/booking/ServiceList";
import BusinessInfo from "../components/booking/BusinessInfo";
import AccountBadge from "../components/ui/AccountBadge";
import NotificationCenter from "../components/ui/NotificationCenter";
import { useToast } from "../components/ui/ToastProvider";
import { endSession, type UserRole } from "../lib/api";

type StoredUser = { name?: string; role?: UserRole };

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
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

  const askAssistant = (event: React.FormEvent<HTMLFormElement>, suggestedPrompt?: string) => {
    event.preventDefault();
    const prompt = (suggestedPrompt ?? aiPrompt).trim();
    if (!prompt) return;
    setAiPrompt(prompt);
    window.dispatchEvent(new CustomEvent("bookflow:ai-prompt", { detail: { prompt } }));
    document.getElementById("ai-assistant")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fc] text-slate-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:shadow-lg">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8" aria-label="Primary navigation">
          <Link href="/" aria-label="BookFlow AI home" className="group flex shrink-0 items-center gap-2.5">
            <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-slate-950 shadow-lg shadow-indigo-950/15"><Image src="/logo.svg" alt="" width={27} height={27} priority /><span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-400 ring-2 ring-white" /></span>
            <span className="text-base font-bold tracking-tight text-slate-950">Book<span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent transition group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,.35)]">FlowAI</span></span>
          </Link>
          <div className="hidden items-center gap-7 lg:flex"><a href="#services" className="text-sm font-medium text-slate-600 transition-colors hover:text-indigo-700">Services</a><a href="#booking-process" className="text-sm font-medium text-slate-600 transition-colors hover:text-indigo-700">How it works</a><a href="#ai-assistant" className="text-sm font-medium text-slate-600 transition-colors hover:text-indigo-700">AI assistant</a><a href="#about" className="text-sm font-medium text-slate-600 transition-colors hover:text-indigo-700">About</a></div>
          <div className="flex items-center gap-2">
            {user ? <><NotificationCenter /><div className="hidden items-center gap-2 sm:flex"><AccountBadge name={user.name} role={user.role} /><Link href={workspaceHref} className="rounded-full px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">{user.role === "Customer" ? "My bookings" : "Workspace"}</Link></div><Link href={workspaceHref} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-xs font-bold text-indigo-700 sm:hidden" aria-label="Open my bookings">{user.name?.slice(0, 1).toUpperCase() ?? "U"}</Link><button type="button" disabled={signingOut} onClick={() => void logout()} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40" aria-label="Sign out"><LogOut className="h-4 w-4" /></button></> : <><Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Sign in</Link><Link href="/register" className="button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-white transition hover:scale-[1.02] sm:px-4">Get started<ArrowUpRight className="h-4 w-4" /></Link></>}
          </div>
        </nav>
        <nav className="flex items-center justify-center gap-6 overflow-x-auto border-t border-slate-100 px-4 py-2.5 lg:hidden" aria-label="Mobile navigation"><a href="#services" className="shrink-0 text-xs font-semibold text-slate-600 hover:text-indigo-700">Services</a><a href="#booking-process" className="shrink-0 text-xs font-semibold text-slate-600 hover:text-indigo-700">How it works</a><a href="#ai-assistant" className="shrink-0 text-xs font-semibold text-slate-600 hover:text-indigo-700">AI assistant</a><a href="#about" className="shrink-0 text-xs font-semibold text-slate-600 hover:text-indigo-700">About</a></nav>
      </header>

      <section id="main-content" className="relative isolate border-b border-slate-200 bg-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_90%_10%,rgba(99,102,241,.08),transparent_38%)]" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1fr_.95fr] lg:items-center lg:gap-14 lg:px-8 lg:py-20">
          <div>
          <div className="soft-enter">
            <span className="section-kicker"><Sparkles className="h-3.5 w-3.5" />Appointments, made simpler</span>
            <h1 className="mt-6 max-w-2xl text-[2.65rem] font-semibold leading-[1.06] tracking-[-.05em] text-slate-950 sm:text-6xl lg:text-[4.1rem]">Make room for<br /><span className="text-indigo-600">what matters.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">Discover trusted services, find a time that fits, and manage your appointments in one calm, straightforward place.</p>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#services" className="button-primary inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition hover:brightness-105">Browse services<ArrowRight className="h-4 w-4" /></a>
            <form onSubmit={(event) => askAssistant(event, "Help me find the right service for me")}><button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"><Sparkles className="h-4 w-4 text-indigo-700" />Ask BookFlow AI</button></form>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-200 pt-5 text-xs font-medium text-slate-600 sm:text-sm"><span className="inline-flex items-center gap-2"><CalendarCheck2 className="h-4 w-4 text-indigo-600" />Choose a time that works</span><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" />Secure checkout</span><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-indigo-600" />Manage bookings in one place</span></div>
          </div>
          <div id="ai-assistant" className="scroll-mt-32 rounded-[1.75rem] bg-slate-100 p-2 shadow-[0_24px_65px_-36px_rgba(15,23,42,.25)] sm:p-3">
            <AiChatWidget />
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><ServiceList showSearchControl /></section>

      <section id="booking-process" className="border-y border-slate-200 bg-white" aria-label="How BookFlow works"><div className="mx-auto grid max-w-7xl gap-3 px-4 py-7 sm:grid-cols-3 sm:px-6 lg:px-8">{[{ icon: Search, title: "Explore", text: "Browse services and compare what fits." }, { icon: UsersRound, title: "Choose", text: "Pick your provider and a live time slot." }, { icon: CalendarCheck2, title: "Book", text: "Confirm your appointment in a few steps." }].map((item, index) => <article key={item.title} className="flex items-start gap-4 rounded-2xl border border-transparent p-4 transition-colors hover:border-slate-200 hover:bg-white"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"><item.icon className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Step 0{index + 1}</p><h2 className="mt-1 text-sm font-semibold text-slate-900">{item.title}</h2><p className="mt-1 text-sm leading-5 text-slate-600">{item.text}</p></div></article>)}</div></section>

      <section aria-label="AI booking assistance" className="border-y border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="max-w-2xl"><span className="section-kicker"><Sparkles className="h-3.5 w-3.5" />A smarter way to make plans</span><h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">A helpful assistant, whenever you need one.</h2><p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">Ask about services, availability, or managing a booking. BookFlow AI helps you find the next step in a natural conversation.</p></div>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">{[{ icon: Clock3, title: "Check availability", text: "Get help finding a time that works." }, { icon: HeartHandshake, title: "Find the right service", text: "Describe what you have in mind and get guidance." }, { icon: ShieldCheck, title: "Stay in control", text: "Review your appointment details as you book." }].map((item) => <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"><item.icon className="h-4 w-4" /></span><h3 className="mt-4 text-sm font-semibold text-slate-900">{item.title}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{item.text}</p></article>)}</div>
      </div></section>

      <section id="about" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-16 lg:px-8"><BusinessInfo /></section>

      <section className="px-4 pb-14 sm:px-6 lg:px-8"><div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-16"><div aria-hidden="true" className="absolute -right-10 -top-24 h-80 w-80 rounded-full bg-indigo-500/30 blur-3xl" /><div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-indigo-300">Make time for you</p><h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Your next great appointment is a few clicks away.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Explore services, find your specialist, and choose a time that feels right.</p></div><a href="#services" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 transition hover:scale-[1.02] hover:bg-indigo-50">Find a service<ArrowRight className="h-4 w-4" /></a></div></div></section>

      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8"><div><Link href="/" className="inline-flex items-center gap-2 text-base font-bold text-slate-950"><Image src="/logo.svg" alt="" width={30} height={30} />Book<span className="text-indigo-600">FlowAI</span></Link><p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">A calmer way to discover services and manage your appointments.</p></div><div><h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Explore</h2><div className="mt-3 grid gap-2 text-sm text-slate-500"><a href="#services" className="hover:text-indigo-700">Services</a><a href="#booking-process" className="hover:text-indigo-700">How it works</a><a href="#ai-assistant" className="hover:text-indigo-700">AI assistant</a></div></div><div><h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Your account</h2><div className="mt-3 grid gap-2 text-sm text-slate-500"><Link href="/login" className="hover:text-indigo-700">Sign in</Link><Link href="/register" className="hover:text-indigo-700">Create account</Link><Link href="/protected" className="hover:text-indigo-700">My bookings</Link></div></div><div><h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Book with confidence</h2><div className="mt-3 grid gap-2 text-sm text-slate-500"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" />Secure account access</span><span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-indigo-600" />InstaPay supported</span></div></div><div className="border-t border-slate-200 pt-5 text-xs text-slate-500 sm:col-span-2 lg:col-span-4"><span>آ© {new Date().getFullYear()} BookFlowAI</span><span className="ml-3">A little less admin. A little more life.</span></div></div></footer>
    </main>
  );
}

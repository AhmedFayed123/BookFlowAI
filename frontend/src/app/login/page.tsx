"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authApi, authStorage, type AuthResponse } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result: AuthResponse = await authApi.login({ email, password });
      authStorage.setAccessToken(result.token);
      authStorage.setRefreshToken(result.refreshToken);
      window.localStorage.setItem(
        "bookflow_user",
        JSON.stringify({
          name: result.name,
          email: result.email,
          role: result.role,
        }),
      );

      if (result.role === "Admin") {
        router.push("/admin/dashboard");
        return;
      }

      if (result.role === "Staff") {
        router.push("/staff");
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get("returnTo");
      const safeReturnPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";
      router.push(safeReturnPath);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to sign in right now.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[1.02fr_.98fr]">
      <aside className="auth-story relative hidden min-h-screen overflow-hidden px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <Link href="/" className="relative z-10 flex items-center gap-3 text-lg font-semibold tracking-tight"><span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 font-bold">B</span>BookFlow <span className="-ml-2 font-normal text-indigo-200">AI</span></Link>
        <div className="relative z-10 max-w-xl pb-10">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-indigo-100">SMARTER APPOINTMENTS</p>
          <h2 className="text-5xl font-semibold leading-[1.08] tracking-tight xl:text-6xl">Make room for what matters.</h2>
          <p className="mt-6 max-w-md text-base leading-7 text-indigo-100/80">Your services, schedule, and next steps come together in one calm workspace.</p>
          <div className="mt-10 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl"><span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-400/20 text-xs font-bold text-indigo-100">BF</span><div><p className="text-sm font-semibold">A smoother way to plan</p><p className="mt-1 text-xs text-indigo-100/70">Thoughtful booking, from start to finish.</p></div></div>
        </div>
        <div aria-hidden="true" className="auth-orb absolute -right-28 top-1/4 h-80 w-80 rounded-full opacity-70 xl:h-[27rem] xl:w-[27rem]" />
        <p className="relative z-10 text-xs text-indigo-100/60">BookFlow AI &middot; Your time, well spent.</p>
      </aside>
      <section className="hero-canvas flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
      <div className="w-full max-w-md surface-card rounded-3xl p-7 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.3)] sm:p-10">
        <div className="mb-8">
          <div className="section-kicker">
            BookFlow AI
          </div>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Sign in to manage services, bookings, and AI insights.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field-control w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition-all duration-200 ease-in-out focus:border-slate-400 focus:bg-white"
              placeholder="name@company.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition-all duration-200 ease-in-out focus:border-slate-400 focus:bg-white"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl button-primary px-4 py-3 text-sm font-semibold text-white  transition-all duration-200 ease-in-out hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Need an account?{" "}
          <Link href="/register" className="font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4 hover:text-indigo-900">
            Create one
          </Link>
        </div>
      </div>
      </section>
    </main>
  );
}

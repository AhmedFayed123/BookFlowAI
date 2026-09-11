"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="max-w-lg rounded-[30px] border border-rose-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-black text-slate-900">We could not load this screen</h1>
        <p className="mt-3 text-sm text-slate-600">Please retry. If the problem continues, check that the API services are available.</p>
        <button onClick={reset} className="mt-6 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white">Try again</button>
      </div>
    </main>
  );
}

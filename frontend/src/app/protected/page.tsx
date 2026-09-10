"use client";

import ProtectedRoute from "../../components/auth/ProtectedRoute";

export default function ProtectedPage() {
  return (
    <ProtectedRoute requiredRole="Customer">
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600">
            Protected area
          </p>
          <h1 className="mt-3 text-3xl font-black text-slate-900">
            Customer workspace
          </h1>
          <p className="mt-3 text-slate-600">
            This page is only visible after a valid authenticated session.
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}

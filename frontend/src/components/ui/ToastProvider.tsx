"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "warning" | "info";
type Toast = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { toast: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-indigo-200 bg-indigo-50 text-indigo-900",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef(new Map<number, number>());
  const remove = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timersRef.current.delete(id);
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);
  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items.slice(-2), { id, message, tone }]);
    const timer = window.setTimeout(() => {
      remove(id);
      timersRef.current.delete(id);
    }, 4500);
    timersRef.current.set(id, timer);
  }, [remove]);
  useEffect(() => () => { timersRef.current.forEach((timer) => window.clearTimeout(timer)); }, []);
  const value = useMemo(() => ({ toast }), [toast]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite">
      {toasts.map((item) => {
        const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "info" ? Info : AlertTriangle;
        return <div key={item.id} className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur ${toneClasses[item.tone]}`} role={item.tone === "error" ? "alert" : "status"}>
          <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="flex-1 text-sm font-medium leading-5">{item.message}</p>
          <button type="button" onClick={() => remove(item.id)} className="rounded-lg p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100" aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
        </div>;
      })}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

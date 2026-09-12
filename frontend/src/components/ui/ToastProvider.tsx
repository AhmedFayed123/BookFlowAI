"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { Toaster, toast as sonnerToast } from "sonner";
import { publishNotification } from "../../lib/notifications";

type ToastTone = "success" | "error" | "warning" | "info";
type ToastContextValue = { toast: (message: string, tone?: ToastTone) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    sonnerToast[tone](message);
    if (tone === "error" || tone === "warning") publishNotification({
      id: `system:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      kind: "system", title: tone === "error" ? "Something needs your attention" : "Account & system notice",
      message, createdAt: new Date().toISOString(),
    });
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return <ToastContext.Provider value={value}>{children}<Toaster position="bottom-right" closeButton richColors visibleToasts={3} duration={4500} theme="light" toastOptions={{ style: { borderRadius: "16px", fontFamily: "var(--font-geist-sans)", backdropFilter: "blur(16px)" } }} /></ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

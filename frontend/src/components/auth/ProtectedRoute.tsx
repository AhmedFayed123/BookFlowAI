"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "../../lib/api";
import AsyncState from "../ui/AsyncState";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredRole?: UserRole;
  fallbackPath?: string;
};

const getStoredUser = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem("bookflow_user");
    if (!raw) return null;
    return JSON.parse(raw) as { role?: UserRole };
  } catch {
    return null;
  }
};

const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem("access_token") ||
    document.cookie
      .split("; ")
      .find((row) => row.startsWith("access_token="))
      ?.split("=")[1] ||
    null
  );
};

export default function ProtectedRoute({
  children,
  requiredRole,
  fallbackPath = "/login",
}: ProtectedRouteProps) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    const user = getStoredUser();

    if (!token) {
      router.replace(fallbackPath);
      return;
    }

    if (requiredRole && user?.role !== requiredRole) {
      router.replace(fallbackPath);
      return;
    }

    const timer = window.setTimeout(() => setIsReady(true), 0);
    return () => window.clearTimeout(timer);
  }, [fallbackPath, requiredRole, router]);

  if (!isReady) {
    return (
      <div className="hero-canvas flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-2xl"><AsyncState loading /></div>
      </div>
    );
  }

  return <>{children}</>;
}

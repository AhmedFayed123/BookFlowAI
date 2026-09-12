import Link from "next/link";
import { UserRound } from "lucide-react";

export default function AccountBadge({ name, role }: { name?: string; role?: string }) {
  const displayName = name?.trim() || "My account";
  const initials = name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <Link href="/account" aria-label={`Account: ${displayName}`} className="inline-flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 hover:border-slate-300 hover:bg-slate-50">
      <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">{initials || <UserRound className="h-4 w-4" />}</span>
      <span className="min-w-0"><span dir="auto" title={displayName} className="block max-w-48 truncate text-sm font-semibold text-slate-900">{displayName}</span>{role && <span className="block text-[11px] text-slate-500">{role}</span>}</span>
    </Link>
  );
}

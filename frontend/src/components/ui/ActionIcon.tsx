import { Archive, ArrowRight, Check, Pencil, RefreshCw, Save, X, type LucideIcon } from "lucide-react";

export default function ActionIcon({ action }: { action: string }) {
  const icons: Record<string, LucideIcon> = { archive: Archive, edit: Pencil, cancel: X, retry: RefreshCw, save: Save, submit: Check };
  const Icon = icons[action] ?? ArrowRight;
  return <Icon aria-hidden="true" className="mr-1.5 inline h-4 w-4 shrink-0 align-text-bottom" />;
}

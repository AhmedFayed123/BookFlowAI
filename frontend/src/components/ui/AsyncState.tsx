import { CircleAlert, RotateCcw } from "lucide-react";
import ActionIcon from "../../components/ui/ActionIcon";

export const fieldClass = "field-control mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-800";
export const buttonClass = "rounded-lg button-primary px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40";
export const cardClass = "space-y-4 surface-card rounded-2xl p-6";

export default function AsyncState({ loading, error, retry }: { loading: boolean; error?: string | null; retry?: () => void }) {
  if (loading) return <div role="status" aria-label="Loading data" className="grid gap-4 sm:grid-cols-2">{[1, 2].map((item) => <div key={item} className="skeleton-shimmer rounded-xl border border-slate-200 bg-white p-6"><div className="h-4 w-1/3 rounded bg-slate-200" /><div className="mt-4 h-12 rounded bg-slate-100" /></div>)}</div>;
  if (error) return <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-sm text-rose-800"><CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><div><p>{error}</p>{retry && <button type="button" onClick={retry} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white/70 px-3 py-2 font-semibold"><RotateCcw aria-hidden="true" className="h-4 w-4" /><ActionIcon action="retry" />Try again</button>}</div></div>;
  return null;
}

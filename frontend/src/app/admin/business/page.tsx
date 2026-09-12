"use client";

import { useCallback, useEffect, useState } from "react";
import ActionIcon from "../../../components/ui/ActionIcon";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import WorkspaceShell from "../../../components/ui/WorkspaceShell";
import AsyncState, { buttonClass, cardClass, fieldClass } from "../../../components/ui/AsyncState";
import { useToast } from "../../../components/ui/ToastProvider";
import { adminApi, aiApi, businessInfoApi, type NoShowPredictionRequest, type NoShowPredictionResponse, type UpdateBusinessAiDataDto } from "../../../lib/api";

const defaultBusiness: UpdateBusinessAiDataDto = { businessName: "", industryCategory: "", workingHoursInfo: "", policyInfo: "", servicesSummary: "", customInstructions: "" };
const defaultPrediction: NoShowPredictionRequest = { customerId: 0, totalPastBookings: 0, pastNoShowsCount: 0, pastCancellationsCount: 0, leadTimeDays: 1, bookingHour: 9, bookingDayOfWeek: 1, isWeekend: false, isHoliday: false, daysSinceLastNoShow: null };
const numericFields = [
  ["customerId", "Customer ID", 1], ["totalPastBookings", "Past bookings", 0], ["pastNoShowsCount", "Past no-shows", 0],
  ["pastCancellationsCount", "Past cancellations", 0], ["leadTimeDays", "Lead time (days)", 0],
  ["bookingHour", "Booking hour (0–23)", 0], ["bookingDayOfWeek", "Day of week (Sunday = 0)", 0],
] as const;

export default function BusinessPage() {
  const { toast } = useToast();
  const [business, setBusiness] = useState(defaultBusiness);
  const [prediction, setPrediction] = useState(defaultPrediction);
  const [result, setResult] = useState<NoShowPredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const config = (await businessInfoApi.getInfo()).find((item) => item.category === "AIConfiguration");
      if (config) {
        const read = (label: string, next?: string) => config.content.match(new RegExp(label + ": ([\\s\\S]*?)(?=" + (next ? "\\n" + next + ":" : "$" ) + ")"))?.[1].trim() ?? "";
        setBusiness({ businessName: read("Business", "Industry"), industryCategory: read("Industry", "Hours"), workingHoursInfo: read("Hours", "Policies"), policyInfo: read("Policies", "Instructions"), customInstructions: read("Instructions"), servicesSummary: "" });
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load business context."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { const response = await adminApi.updateBusinessAiData(business); toast(response.message || "Business context indexed.", "success"); }
    catch (caught) { toast(caught instanceof Error ? caught.message : "AI knowledge service is unavailable. Your changes were not confirmed.", "error"); }
    finally { setSaving(false); }
  };
  const predict = async (event: React.FormEvent) => {
    event.preventDefault(); setPredicting(true); setPredictionError(null); setResult(null);
    try { setResult(await aiApi.getPrediction(prediction)); }
    catch (caught) { setPredictionError(caught instanceof Error ? caught.message : "Prediction is unavailable."); }
    finally { setPredicting(false); }
  };

  return <ProtectedRoute requiredRole="Admin"><WorkspaceShell role="Admin" eyebrow="Business intelligence" title="Business & AI" description="Give the booking assistant useful context and inspect no-show forecasts.">
    <AsyncState loading={loading} error={error} retry={() => void load()} />
    {!loading && !error && <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={save} className={cardClass}><h2 className="text-xl font-semibold">Assistant business context</h2><p className="text-xs leading-5 text-slate-500">Saving replaces the indexed business context and includes active services from SQL. This may take longer on the first indexing request.</p>
        <label className="block text-sm font-medium">Business name<input required value={business.businessName} onChange={(event) => setBusiness({ ...business, businessName: event.target.value })} className={fieldClass} /></label>
        <label className="block text-sm font-medium">Industry<input value={business.industryCategory ?? ""} onChange={(event) => setBusiness({ ...business, industryCategory: event.target.value })} className={fieldClass} /></label>
        {([["workingHoursInfo", "Working hours"], ["policyInfo", "Booking & cancellation policies"], ["customInstructions", "Assistant instructions"]] as const).map(([key, label]) => <label key={key} className="block text-sm font-medium">{label}<textarea required={key !== "customInstructions"} rows={3} value={business[key]} onChange={(event) => setBusiness({ ...business, [key]: event.target.value })} className={fieldClass} /></label>)}
        <button disabled={saving} className={buttonClass}><ActionIcon action="save" />{saving ? "Indexing…" : "Save business context"}</button>
      </form>
      <form onSubmit={predict} className={cardClass}><h2 className="text-xl font-semibold">No-show forecast</h2><p className="text-xs leading-5 text-slate-500">Inspect a forecast using real customer history. This does not modify a booking.</p><div className="grid gap-4 sm:grid-cols-2">{numericFields.map(([key, label, min]) => <label key={key} className="text-sm font-medium">{label}<input required type="number" min={min} max={key === "bookingHour" ? 23 : key === "bookingDayOfWeek" ? 6 : undefined} step="1" value={prediction[key]} onChange={(event) => setPrediction({ ...prediction, [key]: Number(event.target.value) })} className={fieldClass} /></label>)}</div>
        <label className="block text-sm font-medium">Days since last no-show (optional)<input type="number" min="0" value={prediction.daysSinceLastNoShow ?? ""} onChange={(event) => setPrediction({ ...prediction, daysSinceLastNoShow: event.target.value === "" ? null : Number(event.target.value) })} className={fieldClass} /></label>
        <div className="flex gap-4">{([["isWeekend", "Weekend"], ["isHoliday", "Holiday"]] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prediction[key]} onChange={(event) => setPrediction({ ...prediction, [key]: event.target.checked })} />{label}</label>)}</div>
        <button disabled={predicting} className={buttonClass}>{predicting ? "Calculating…" : "Get forecast"}</button><AsyncState loading={false} error={predictionError} />{result && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-medium">{result.riskLevel} risk · {(result.probability * 100).toFixed(1)}%</p><p className="mt-2 text-xs text-slate-600">Model: {result.modelVersion}{result.isFallback ? " · Fallback estimate, not a live model prediction" : " · Model prediction"}</p></div>}
      </form>
    </div>}
  </WorkspaceShell></ProtectedRoute>;
}

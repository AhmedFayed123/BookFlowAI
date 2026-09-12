"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyticsApi,
  type AnalyticsSummaryDto,
  type NoShowRateDto,
  type PeakHourDto,
  type ServicePerformanceDto,
} from "../../lib/api";

const emptySummary: AnalyticsSummaryDto = { totalRevenue: 0, totalBookings: 0, cancelledBookings: 0, cancellationRatePercentage: 0 };
const emptyNoShow: NoShowRateDto = { overallNoShowRatePercentage: 0, totalNoShowCount: 0, highRiskPredictionsCount: 0 };

export default function AnalyticsPanel() {
  const [summary, setSummary] = useState(emptySummary);
  const [services, setServices] = useState<ServicePerformanceDto[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHourDto[]>([]);
  const [noShow, setNoShow] = useState(emptyNoShow);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      analyticsApi.getSummary(),
      analyticsApi.getServicesPerformance(),
      analyticsApi.getPeakHours(),
      analyticsApi.getNoShowRate(),
    ]).then(([summaryResult, servicesResult, peakResult, noShowResult]) => {
      if (!active) return;
      setSummary(summaryResult);
      setServices(servicesResult);
      setPeakHours(peakResult);
      setNoShow(noShowResult);
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof Error ? requestError.message : "Analytics are temporarily unavailable.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let cancelRequest: (() => void) | undefined;
    const timer = window.setTimeout(() => { cancelRequest = loadAnalytics(); }, 0);
    return () => {
      window.clearTimeout(timer);
      cancelRequest?.();
    };
  }, [loadAnalytics]);

  const maxRevenue = useMemo(() => Math.max(...services.map((item) => item.totalRevenueGenerated), 1), [services]);
  const maxPeak = useMemo(() => Math.max(...peakHours.map((item) => item.bookingCount), 1), [peakHours]);
  const completionHealth = Math.max(0, 100 - summary.cancellationRatePercentage - noShow.overallNoShowRatePercentage);

  return (
    <section className="space-y-6 surface-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold tracking-wide text-emerald-700">Analytics</p><h3 className="mt-2 text-xl font-semibold text-slate-900">Live business performance</h3></div>
        <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{loading ? "Syncing..." : error ? "Unavailable" : "Live"}</div>
      </div>

      {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><p>{error}</p><button type="button" onClick={loadAnalytics} className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white">Retry analytics</button></div>}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Revenue", `$${summary.totalRevenue.toFixed(2)}`],
          ["Bookings", summary.totalBookings.toString()],
          ["Cancellation rate", `${summary.cancellationRatePercentage.toFixed(1)}%`],
          ["No-show rate", `${noShow.overallNoShowRatePercentage.toFixed(1)}%`],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs tracking-wide text-slate-500">{label}</div><div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div></div>)}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-4 text-sm font-semibold text-slate-700">Service performance</h4>
          <div className="space-y-4">
            {services.length === 0 && <p className="text-sm text-slate-500">No completed bookings yet.</p>}
            {services.map((item) => <div key={item.serviceId}><div className="mb-1 flex justify-between gap-3 text-sm text-slate-700"><span>{item.serviceName}</span><span>${item.totalRevenueGenerated.toFixed(2)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full button-primary" style={{ width: `${(item.totalRevenueGenerated / maxRevenue) * 100}%` }} /></div><div className="mt-1 text-xs text-slate-500">{item.totalBookings} bookings</div></div>)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-4 text-sm font-semibold text-slate-700">Peak booking hours</h4>
          <div className="space-y-3">
            {peakHours.length === 0 && <p className="text-sm text-slate-500">No booking activity yet.</p>}
            {peakHours.map((item) => <div key={item.hour24}><div className="mb-1 flex justify-between text-xs text-slate-500"><span>{item.displayHour}</span><span>{item.bookingCount} bookings</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full button-primary" style={{ width: `${(item.bookingCount / maxPeak) * 100}%` }} /></div></div>)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900">
        <div className="text-sm font-medium text-slate-600">Operational health</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-3"><div className="text-xs text-slate-500">Successful booking health</div><div className="mt-2 text-2xl font-semibold">{completionHealth.toFixed(1)}%</div></div>
          <div className="rounded-xl bg-white p-3"><div className="text-xs text-slate-500">High-risk predictions</div><div className="mt-2 text-2xl font-semibold">{noShow.highRiskPredictionsCount}</div></div>
          <div className="rounded-xl bg-white p-3"><div className="text-xs text-slate-500">Recorded no-shows</div><div className="mt-2 text-2xl font-semibold">{noShow.totalNoShowCount}</div></div>
        </div>
      </div>
    </section>
  );
}

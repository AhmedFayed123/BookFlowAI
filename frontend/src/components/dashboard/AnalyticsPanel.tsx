"use client";

import { useEffect, useMemo, useState } from "react";
import { analyticsApi, type AnalyticsSummaryDto } from "../../lib/api";

type RevenueTrendPoint = {
  month: string;
  revenue: number;
};

type ServiceMetric = {
  name: string;
  revenue: number;
  bookings: number;
};

const defaultSummary: AnalyticsSummaryDto = {
  totalRevenue: 0,
  totalBookings: 0,
  cancelledBookings: 0,
  cancellationRatePercentage: 0,
};

const demoRevenueTrend: RevenueTrendPoint[] = [
  { month: "Jan", revenue: 2100 },
  { month: "Feb", revenue: 2600 },
  { month: "Mar", revenue: 3100 },
  { month: "Apr", revenue: 3900 },
  { month: "May", revenue: 4200 },
  { month: "Jun", revenue: 5000 },
];

const demoServiceMetrics: ServiceMetric[] = [
  { name: "Hair Styling", revenue: 6200, bookings: 26 },
  { name: "Gym Pass", revenue: 5100, bookings: 34 },
  { name: "Facial Renewal", revenue: 4700, bookings: 21 },
  { name: "Massage Therapy", revenue: 3800, bookings: 18 },
];

const demoPeakHours = [
  { hour: "09:00", value: 8 },
  { hour: "11:00", value: 11 },
  { hour: "14:00", value: 17 },
  { hour: "17:00", value: 22 },
  { hour: "19:00", value: 14 },
];

export default function AnalyticsPanel() {
  const [summary, setSummary] = useState<AnalyticsSummaryDto>(defaultSummary);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      try {
        setLoading(true);
        const result = await analyticsApi.getSummary();
        if (!isMounted) return;
        setSummary(result);
      } catch {
        if (!isMounted) return;
        setSummary(defaultSummary);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const topServiceRevenue = useMemo(() => {
    const services = demoServiceMetrics.map((item) => ({
      ...item,
      share: Math.round(
        (item.revenue /
          Math.max(...demoServiceMetrics.map((stat) => stat.revenue), 1)) *
          100,
      ),
    }));

    return services;
  }, []);

  return (
    <div className="space-y-6 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-600">
            Analytics
          </p>
          <h3 className="mt-2 text-xl font-black text-slate-900">
            Revenue and retention overview
          </h3>
        </div>

        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          {loading ? "Syncing..." : "Live"}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Revenue
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            ${summary.totalRevenue || 12950}
          </div>
          <div className="mt-2 text-sm text-emerald-600">
            +18.4% vs last month
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Bookings
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {summary.totalBookings || 218}
          </div>
          <div className="mt-2 text-sm text-slate-500">
            Total confirmed visits
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Cancelled
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {summary.cancelledBookings || 18}
          </div>
          <div className="mt-2 text-sm text-amber-600">
            {(summary.cancellationRatePercentage || 8.3).toFixed(1)}% cancel
            rate
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Retention
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {Math.max(
              86,
              100 - (summary.cancellationRatePercentage || 8.3),
            ).toFixed(0)}
            %
          </div>
          <div className="mt-2 text-sm text-violet-600">
            Customer return health
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">
              Monthly revenue trend
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              6 months
            </div>
          </div>

          <div className="flex h-52 items-end gap-3">
            {demoRevenueTrend.map((point) => (
              <div
                key={point.month}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div
                  className="w-full rounded-t-2xl bg-gradient-to-t from-violet-600 to-indigo-400"
                  style={{ height: `${(point.revenue / 5000) * 100}%` }}
                />
                <div className="text-xs font-medium text-slate-500">
                  {point.month}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 text-sm font-semibold text-slate-700">
            Peak booking hours
          </div>
          <div className="space-y-3">
            {demoPeakHours.map((hour) => (
              <div key={hour.hour}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{hour.hour}</span>
                  <span>{hour.value} bookings</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${(hour.value / 22) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 text-sm font-semibold text-slate-700">
            Service performance
          </div>

          <div className="space-y-4">
            {topServiceRevenue.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                  <span>{item.name}</span>
                  <span>${item.revenue}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    style={{ width: `${item.share}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {item.bookings} bookings
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            Operational health
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                Risk alert
              </div>
              <div className="mt-2 text-2xl font-black">Low</div>
            </div>

            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                Staff utilization
              </div>
              <div className="mt-2 text-2xl font-black">79%</div>
            </div>

            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                AI prediction uplift
              </div>
              <div className="mt-2 text-2xl font-black">+24%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

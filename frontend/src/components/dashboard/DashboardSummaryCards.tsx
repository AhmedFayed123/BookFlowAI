type DashboardSummaryCardsProps = {
  totalBookingsToday: number;
  pendingRequests: number;
  averageNoShowRisk: number;
};

export default function DashboardSummaryCards({
  totalBookingsToday,
  pendingRequests,
  averageNoShowRisk,
}: DashboardSummaryCardsProps) {
  const cards = [
    {
      label: "Total Bookings Today",
      value: totalBookingsToday,
      accent: "from-violet-600 to-indigo-600",
      subtitle: "Live appointments",
    },
    {
      label: "Pending Requests",
      value: pendingRequests,
      accent: "from-amber-500 to-orange-500",
      subtitle: "Awaiting review",
    },
    {
      label: "Avg. No-Show Risk",
      value: `${averageNoShowRisk.toFixed(1)}%`,
      accent: "from-emerald-500 to-teal-500",
      subtitle: "AI risk score",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
          <div className={`h-1.5 bg-gradient-to-r ${card.accent}`} />
          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {card.label}
            </div>
            <div className="mt-4 text-3xl font-black text-slate-900">
              {card.value}
            </div>
            <div className="mt-2 text-sm text-slate-500">{card.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

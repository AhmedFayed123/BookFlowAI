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
      subtitle: "Live appointments",
    },
    {
      label: "Pending Requests",
      value: pendingRequests,
      subtitle: "Awaiting review",
    },
    {
      label: "Avg. No-Show Risk",
      value: `${averageNoShowRisk.toFixed(1)}%`,
      subtitle: "AI risk score",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="overflow-hidden surface-card rounded-2xl shadow-sm"
        >
          <div className="p-5">
            <div className="text-sm font-medium text-slate-500">
              {card.label}
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-900">
              {card.value}
            </div>
            <div className="mt-2 text-sm text-slate-500">{card.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

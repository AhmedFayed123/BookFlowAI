import Link from "next/link";

type DashboardSummaryCardsProps = {
  totalBookingsToday: number;
  confirmedToday: number;
  pendingRequests: number;
  averageNoShowRisk: number;
};

export default function DashboardSummaryCards({
  totalBookingsToday,
  confirmedToday,
  pendingRequests,
  averageNoShowRisk,
}: DashboardSummaryCardsProps) {
  const cards: Array<{ label: string; value: string | number; subtitle: string; href?: string }> = [
    {
      label: "Today's bookings",
      value: totalBookingsToday,
      subtitle: `${confirmedToday} confirmed appointments`,
    },
    {
      label: "Pending Requests",
      value: pendingRequests,
      subtitle: "Awaiting review",
      href: "#booking-feed",
    },
    {
      label: "Avg. No-Show Risk",
      value: `${averageNoShowRisk.toFixed(1)}%`,
      subtitle: "AI risk score",
    },
    {
      label: "Confirmed today",
      value: confirmedToday,
      subtitle: "Ready for service",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className={`group relative overflow-hidden surface-card rounded-2xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${card.href ? "border-amber-200/80" : ""}`}
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2"><div className="text-sm font-medium text-slate-500">{card.label}</div><span className={`h-2 w-2 rounded-full ${card.href ? "bg-amber-500" : "bg-indigo-500"}`} /></div>
            <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{card.value}</div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500"><span>{card.subtitle}</span>{card.href && <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800">Needs attention</span>}</div>
            {card.href && <Link href={card.href} className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"><span className="sr-only">Open pending booking requests</span></Link>}
          </div>
        </article>
      ))}
    </div>
  );
}

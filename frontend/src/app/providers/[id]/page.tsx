"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AsyncState, { cardClass } from "../../../components/ui/AsyncState";
import { reviewsApi, staffApi, type ReviewDto, type StaffProfileDto } from "../../../lib/api";

export default function ProviderPage() {
  const { id } = useParams<{ id: string }>();
  const [provider, setProvider] = useState<StaffProfileDto | null>(null);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null); setReviewError(null);
    try {
      if (!Number.isInteger(Number(id)) || Number(id) < 1) throw new Error("Invalid provider reference.");
      setProvider(await staffApi.getById(Number(id)));
      try { setReviews(await reviewsApi.getByStaff(Number(id))); }
      catch (caught) { setReviewError(caught instanceof Error ? caught.message : "Reviews are unavailable."); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load provider."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-4 py-8 sm:px-6"><Link href="/#services" className="text-sm font-medium text-emerald-800">← Back to services</Link><AsyncState loading={loading} error={error} retry={() => void load()} />{!loading && !error && provider && <>
    <section className={cardClass}><p className="text-sm text-emerald-800">Your service provider</p><h1 className="text-3xl font-semibold">{provider.name}</h1><p className="text-sm text-slate-600">{provider.specialties || "Contact your provider for qualification details."}</p><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Working hours</dt><dd className="mt-1">{provider.workingHours || "See available times when booking."}</dd></div><div><dt className="text-slate-500">Average rating</dt><dd className="mt-1">{provider.averageRating > 0 ? `${provider.averageRating.toFixed(1)} / 5` : "Not rated yet"}</dd></div></dl><p className="text-sm text-slate-500">{provider.isAvailable ? "Accepting bookings" : "Not currently accepting bookings"}</p><div className="flex flex-wrap gap-2">{provider.services?.map((service) => <Link key={service.id} href={`/services/${service.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-50">{service.name}</Link>)}</div></section>
    <section className={cardClass}><h2 className="text-xl font-semibold">Customer reviews</h2><AsyncState loading={false} error={reviewError} retry={() => void load()} />{!reviewError && reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}{reviews.map((item) => <article key={item.id} className="border-t border-slate-100 pt-4"><p className="text-sm font-medium">{item.customerName} · {item.rating}/5</p><p className="mt-2 text-sm text-slate-600">{item.comment || "No written comment."}</p></article>)}</section>
  </>}</main>;
}

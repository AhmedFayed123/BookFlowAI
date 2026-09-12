"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AsyncState, { buttonClass, cardClass } from "../../../components/ui/AsyncState";
import { authStorage, servicesApi, staffApi, type ServiceDto, type StaffProfileDto } from "../../../lib/api";

export default function ServicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [service, setService] = useState<ServiceDto | null>(null);
  const [providers, setProviders] = useState<StaffProfileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (!Number.isInteger(Number(id)) || Number(id) < 1) throw new Error("Invalid service reference.");
      const [result, people] = await Promise.all([servicesApi.getById(Number(id)), staffApi.getStaff(Number(id))]);
      setService(result); setProviders(people);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load service."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const book = () => {
    window.sessionStorage.setItem("bookflow_pending_service", id);
    router.push(authStorage.hasActiveSession() ? "/#services" : `/login?returnTo=${encodeURIComponent("/#services")}`);
  };
  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-4 py-8 sm:px-6"><Link href="/#services" className="text-sm font-medium text-emerald-800">← Back to services</Link><AsyncState loading={loading} error={error} retry={() => void load()} />{!loading && !error && service && <>
    <section className={cardClass}><p className="text-sm text-emerald-800">{service.businessCategoryName}</p><h1 className="text-3xl font-semibold">{service.name}</h1><p className="text-sm leading-6 text-slate-600">{service.description}</p><p className="text-sm font-medium">${service.price.toFixed(2)} · {service.durationInMinutes} minutes</p><button disabled={providers.length === 0} onClick={book} className={buttonClass}>Choose an available time</button>{providers.length === 0 && <p className="text-sm text-slate-500">No providers are currently available for this service.</p>}</section>
    <section className={cardClass}><h2 className="text-xl font-semibold">Meet your providers</h2>{providers.map((person) => <Link key={person.id} href={`/providers/${person.id}`} className="block rounded-xl border border-slate-200 p-4 hover:bg-slate-50"><p className="font-medium">{person.name}</p><p className="mt-1 text-sm text-slate-500">{person.specialties || "View provider details"} · {person.averageRating > 0 ? `${person.averageRating.toFixed(1)}/5` : "Not rated yet"}</p></Link>)}</section>
  </>}</main>;
}

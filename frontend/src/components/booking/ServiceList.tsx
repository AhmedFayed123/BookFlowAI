"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, CalendarDays, Clock3, RotateCcw, Search, Sparkles } from "lucide-react";
import { authStorage, servicesApi, type ServiceDto } from "../../lib/api";
import { filterAndSortServices, getMaximumServicePrice, type ServiceSort } from "../../lib/serviceFilters";
import { useToast } from "../ui/ToastProvider";
import BookingModal from "./BookingModal";

type ServiceListProps = { initialSelectedService?: ServiceDto | null };

export default function ServiceList({ initialSelectedService = null }: ServiceListProps) {
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [minimumPrice, setMinimumPrice] = useState(0);
  const [maximumPrice, setMaximumPrice] = useState(Number.MAX_SAFE_INTEGER);
  const [sort, setSort] = useState<ServiceSort>("popular");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedService, setSelectedService] = useState<ServiceDto | null>(initialSelectedService);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await servicesApi.getServices();
        if (!active) return;
        setServices(result);
        setMaximumPrice(getMaximumServicePrice(result) || Number.MAX_SAFE_INTEGER);
        const pendingServiceId = Number(window.sessionStorage.getItem("bookflow_pending_service"));
        const pendingService = result.find((service) => service.id === pendingServiceId);
        if (pendingService && authStorage.hasActiveSession()) {
          setSelectedService(pendingService);
          window.sessionStorage.removeItem("bookflow_pending_service");
        }
      } catch (caught) {
        if (!active) return;
        const message = caught instanceof Error ? caught.message : "Services are temporarily unavailable.";
        setError(message);
        toast(message, "error");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [retryKey, toast]);

  const categories = useMemo(() => Array.from(new Map(services.map((service) => [
    service.businessCategoryId,
    { id: service.businessCategoryId, name: service.businessCategoryName },
  ])).values()).sort((left, right) => left.name.localeCompare(right.name)), [services]);
  const priceCeiling = useMemo(() => getMaximumServicePrice(services), [services]);
  const visibleServices = useMemo(() => filterAndSortServices(services, {
    query: debouncedSearch, categoryId, minimumPrice, maximumPrice, sort,
  }), [categoryId, debouncedSearch, maximumPrice, minimumPrice, services, sort]);
  const hasFilters = Boolean(search || categoryId !== null || minimumPrice > 0 || maximumPrice < priceCeiling || sort !== "popular");

  const clearFilters = () => {
    setSearch("");
    setCategoryId(null);
    setMinimumPrice(0);
    setMaximumPrice(priceCeiling || Number.MAX_SAFE_INTEGER);
    setSort("popular");
  };

  const chooseService = (service: ServiceDto) => {
    if (!authStorage.hasActiveSession()) {
      window.sessionStorage.setItem("bookflow_pending_service", String(service.id));
      window.location.assign("/login?returnTo=/%23services");
      return;
    }
    try {
      const storedUser = window.localStorage.getItem("bookflow_user");
      const role = storedUser ? (JSON.parse(storedUser) as { role?: string }).role : undefined;
      if (role && role !== "Customer") {
        toast("Please use a customer account to create a booking.", "warning");
        return;
      }
    } catch { /* the API remains the source of truth when local profile data is unavailable */ }
    setSelectedService(service);
  };

  return <div className="space-y-6">
    <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
      <div className="border-b border-slate-100 p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-violet-700"><Sparkles className="h-4 w-4" />Explore services</div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Find the right experience</h2>
            <p className="mt-2 max-w-2xl text-slate-600">Search every category, compare duration and price, then reserve a verified provider in a few steps.</p></div>
          <label className="relative block w-full lg:max-w-md" htmlFor="service-search">
            <span className="sr-only">Search services</span><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input id="service-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search services or categories…" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 transition focus:border-violet-400 focus:bg-white" />
          </label>
        </div>
      </div>

      <div className="space-y-5 bg-slate-50/70 p-5 sm:p-7">
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Service categories">
          <button type="button" onClick={() => setCategoryId(null)} aria-pressed={categoryId === null} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${categoryId === null ? "bg-slate-950 text-white shadow" : "border border-slate-200 bg-white text-slate-700 hover:border-violet-300"}`}>All services</button>
          {categories.map((category) => <button key={category.id} type="button" onClick={() => setCategoryId(category.id)} aria-pressed={categoryId === category.id} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${categoryId === category.id ? "bg-slate-950 text-white shadow" : "border border-slate-200 bg-white text-slate-700 hover:border-violet-300"}`}>{category.name}</button>)}
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
          <label className="text-sm font-semibold text-slate-700">Minimum price
            <span className="relative mt-2 block"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span><input type="number" min={0} max={maximumPrice} step={1} value={minimumPrice} onChange={(event) => setMinimumPrice(Math.max(0, Math.min(Number(event.target.value) || 0, maximumPrice)))} disabled={!priceCeiling} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-3 text-sm" /></span>
          </label>
          <label className="text-sm font-semibold text-slate-700">Maximum price
            <span className="relative mt-2 block"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span><input type="number" min={minimumPrice} max={priceCeiling || 0} step={1} value={maximumPrice === Number.MAX_SAFE_INTEGER ? priceCeiling : maximumPrice} onChange={(event) => setMaximumPrice(Math.max(minimumPrice, Math.min(Number(event.target.value) || 0, priceCeiling)))} disabled={!priceCeiling} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-3 text-sm" /></span>
          </label>
          <label className="text-sm font-semibold text-slate-700"><span className="mb-2 flex items-center gap-2"><ArrowUpDown className="h-4 w-4" />Sort by</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as ServiceSort)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="popular">Most popular</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="duration">Shortest duration</option></select>
          </label>
          <button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw className="h-4 w-4" />Clear</button>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500" aria-live="polite"><span>{loading ? "Loading services…" : `${visibleServices.length} service${visibleServices.length === 1 ? "" : "s"} found`}</span>{debouncedSearch !== search && <span className="text-violet-600">Searching…</span>}</div>

        {loading ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5"><div className="h-5 w-2/5 rounded bg-slate-200" /><div className="mt-6 h-7 w-3/4 rounded bg-slate-200" /><div className="mt-4 h-16 rounded bg-slate-100" /><div className="mt-6 h-11 rounded-xl bg-slate-200" /></div>)}</div>
          : error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center"><h3 className="font-bold text-rose-900">We couldn’t load services</h3><p className="mt-2 text-sm text-rose-700">{error}</p><button type="button" onClick={() => setRetryKey((value) => value + 1)} className="mt-5 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white">Try again</button></div>
          : visibleServices.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><Search className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-bold text-slate-900">No matching services</h3><p className="mt-1 text-sm text-slate-500">Adjust your search, category, or price range.</p><button type="button" onClick={clearFilters} className="mt-4 text-sm font-bold text-violet-700">Clear all filters</button></div>
          : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleServices.map((service, index) => <article key={service.id} className="soft-enter group flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl" style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}>
            <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{service.businessCategoryName}</span>{service.bookingCount > 0 && <span className="text-xs font-medium text-slate-400">{service.bookingCount} booked</span>}</div>
            <h3 className="mt-5 text-xl font-black text-slate-950">{service.name}</h3><p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">{service.description || "Details will be confirmed with your provider."}</p>
            <div className="mt-6 flex items-center gap-4 border-t border-slate-100 pt-4 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{service.durationInMinutes} min</span><span className="ml-auto text-xl font-black text-slate-950">${service.price.toFixed(2)}</span></div>
            <button type="button" onClick={() => chooseService(service)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:brightness-110 active:scale-[0.98]"><CalendarDays className="h-4 w-4" />Choose a time</button>
          </article>)}</div>}
      </div>
    </div>
    <BookingModal service={selectedService} open={Boolean(selectedService)} onClose={() => setSelectedService(null)} />
  </div>;
}

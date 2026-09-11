"use client";

import { useEffect, useMemo, useState } from "react";
import { servicesApi, type ServiceDto } from "../../lib/api";
import BookingModal from "./BookingModal";

const api = {
  services: {
    getAll: servicesApi.getServices,
  },
};

type ServiceListProps = {
  initialSelectedService?: ServiceDto | null;
};

export default function ServiceList({
  initialSelectedService = null,
}: ServiceListProps) {
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceDto | null>(
    initialSelectedService,
  );

  useEffect(() => {
    let isMounted = true;

    const loadServices = async () => {
      try {
        setLoading(true);
        const result = await api.services.getAll();
        if (!isMounted) return;
        setServices(result);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadServices();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return services;

    return services.filter((service) =>
      [service.name, service.description, service.businessCategoryName]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, services]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600">
              Book a service
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Our services
            </h2>
          </div>

          <div className="w-full max-w-md">
            <label className="sr-only" htmlFor="service-search">
              Search services
            </label>
            <input
              id="service-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by service or keyword"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`service-skeleton-${index}`}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="animate-pulse space-y-4">
                  <div className="h-5 w-2/3 rounded-full bg-slate-200" />
                  <div className="h-4 w-full rounded-full bg-slate-200" />
                  <div className="h-4 w-5/6 rounded-full bg-slate-200" />
                  <div className="flex items-center justify-between">
                    <div className="h-7 w-20 rounded-full bg-slate-200" />
                    <div className="h-10 w-24 rounded-2xl bg-slate-200" />
                  </div>
                </div>
              </div>
            ))
          : filteredServices.map((service) => (
              <article
                key={service.id}
                className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-2xl bg-violet-50 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">
                    {service.businessCategoryName}
                  </div>
                  <div className="text-xs font-medium text-slate-400">
                    {service.durationInMinutes} min
                  </div>
                </div>

                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  {service.name}
                </h3>

                <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">
                  {service.description ||
                    "No description available for this service."}
                </p>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Price
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">
                      ${service.price.toFixed(2)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedService(service)}
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
                  >
                    Book Now
                  </button>
                </div>
              </article>
            ))}
      </div>

      {!loading && filteredServices.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
          No services match your search. Try a different keyword.
        </div>
      )}

      <BookingModal
        service={selectedService}
        open={Boolean(selectedService)}
        onClose={() => setSelectedService(null)}
      />
    </div>
  );
}

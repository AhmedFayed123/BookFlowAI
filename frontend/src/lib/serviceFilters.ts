import type { ServiceDto } from "./api";

export type ServiceSort = "popular" | "price-asc" | "price-desc" | "duration";

export interface ServiceFilters {
  query: string;
  categoryId: number | null;
  minimumPrice?: number;
  maximumPrice: number;
  sort: ServiceSort;
}

export function filterAndSortServices(services: ServiceDto[], filters: ServiceFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  const filtered = services.filter((service) => {
    const matchesQuery = !query || [service.name, service.description, service.businessCategoryName]
      .join(" ").toLocaleLowerCase().includes(query);
    const matchesCategory = filters.categoryId === null || service.businessCategoryId === filters.categoryId;
    return matchesQuery && matchesCategory
      && service.price >= Math.max(0, filters.minimumPrice ?? 0)
      && service.price <= filters.maximumPrice;
  });

  return [...filtered].sort((left, right) => {
    if (filters.sort === "price-asc") return left.price - right.price;
    if (filters.sort === "price-desc") return right.price - left.price;
    if (filters.sort === "duration") return left.durationInMinutes - right.durationInMinutes;
    return right.bookingCount - left.bookingCount || left.name.localeCompare(right.name);
  });
}

export function getMaximumServicePrice(services: ServiceDto[]) {
  return Math.max(0, ...services.map((service) => Math.ceil(service.price)));
}

export function calculateBookingEstimate(price: number, taxRate: number, fee: number) {
  const tax = Math.round(price * Math.max(0, taxRate) * 100) / 100;
  return { subtotal: price, tax, fee, total: Math.round((price + tax + fee) * 100) / 100 };
}

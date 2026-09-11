import { describe, expect, it } from "vitest";
import { calculateBookingEstimate, filterAndSortServices, getMaximumServicePrice } from "../src/lib/serviceFilters";
import type { ServiceDto } from "../src/lib/api";

const services: ServiceDto[] = [
  { id: 1, businessCategoryId: 10, businessCategoryName: "Medical Clinics", name: "Consultation", description: "Initial assessment", price: 80, durationInMinutes: 45, isActive: true, bookingCount: 7 },
  { id: 2, businessCategoryId: 20, businessCategoryName: "Auto Care", name: "Vehicle inspection", description: "Safety checks", price: 50, durationInMinutes: 30, isActive: true, bookingCount: 12 },
  { id: 3, businessCategoryId: 10, businessCategoryName: "Medical Clinics", name: "Follow-up", description: "Review appointment", price: 40, durationInMinutes: 20, isActive: true, bookingCount: 2 },
];

describe("service discovery rules", () => {
  it("filters by query, category, and a complete price range", () => {
    const result = filterAndSortServices(services, { query: "clinic", categoryId: 10, minimumPrice: 30, maximumPrice: 60, sort: "popular" });
    expect(result.map((service) => service.id)).toEqual([3]);
  });

  it("supports price, duration, and popularity sorting", () => {
    expect(filterAndSortServices(services, { query: "", categoryId: null, maximumPrice: 100, sort: "popular" }).map(({ id }) => id)).toEqual([2, 1, 3]);
    expect(filterAndSortServices(services, { query: "", categoryId: null, maximumPrice: 100, sort: "price-asc" }).map(({ id }) => id)).toEqual([3, 2, 1]);
    expect(filterAndSortServices(services, { query: "", categoryId: null, maximumPrice: 100, sort: "duration" }).map(({ id }) => id)).toEqual([3, 2, 1]);
  });

  it("calculates stable totals without mutating service prices", () => {
    expect(calculateBookingEstimate(100, 0.14, 2.5)).toEqual({ subtotal: 100, tax: 14, fee: 2.5, total: 116.5 });
    expect(getMaximumServicePrice(services)).toBe(80);
  });
});

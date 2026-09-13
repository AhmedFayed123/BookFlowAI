import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { accountApi, aiApi, api, authApi, instaPayApi, businessCategoriesApi, reviewsApi } from "../src/lib/api";
import { toScheduleDateTime } from "../src/lib/booking";

const requests: InternalAxiosRequestConfig[] = [];
describe(".NET API request contracts", () => {
  beforeEach(() => {
    requests.length = 0; window.localStorage.clear();
    api.defaults.adapter = vi.fn(async (config) => {
      requests.push(config);
      const data = config.url === "/account/me" ? false : { success: true, message: "Saved" };
      return { data, status: 200, statusText: "OK", headers: {}, config };
    });
  });
  it("routes predictions through the .NET chat controller", async () => {
    await aiApi.getPrediction({ customerId: 5, totalPastBookings: 10, pastNoShowsCount: 1, pastCancellationsCount: 0, leadTimeDays: 2, bookingHour: 9, bookingDayOfWeek: 1, isWeekend: false, isHoliday: false, daysSinceLastNoShow: null });
    expect(requests[0].url).toBe("/ai/chat/predict-no-show");
    expect(JSON.parse(requests[0].data).pastCancellationsCount).toBe(0);
  });
  it("preserves the boolean profile response instead of assuming success", async () => {
    expect(await accountApi.updateProfile({ name: "Updated", phoneNumber: null })).toBe(false);
    expect(requests[0].method).toBe("put");
  });
  it("expects a message, not a review object, after creating a review", async () => {
    expect(await reviewsApi.create({ bookingId: 42, rating: 5, comment: "Helpful" })).toEqual({ success: true, message: "Saved" });
    expect(requests[0].url).toBe("/reviews");
  });
  it("uses correct category CRUD verbs and handles no-content operations", async () => {
    await businessCategoriesApi.create({ name: "Wellness" });
    await businessCategoriesApi.update(8, { name: "Wellness", isActive: true });
    await businessCategoriesApi.remove(8);
    expect(requests.map((request) => [request.method, request.url])).toEqual([["post", "/business-categories"], ["put", "/business-categories/8"], ["delete", "/business-categories/8"]]);
  });
  it("serializes refresh tokens as a JSON string for .NET FromBody string", async () => {
    await authApi.logout("test-refresh-token");
    expect(requests[0].url).toBe("/auth/logout");
    expect(JSON.parse(requests[0].data)).toBe("test-refresh-token");
  });
  it("sends InstaPay reference and optional receipt as multipart form data", async () => {
    const receipt = new File(["receipt"], "receipt.png", { type: "image/png" });
    await instaPayApi.create({ staffId: 8, serviceId: 1, dateTime: "2099-01-05T09:00:00" }, "123456789012", receipt);
    expect(requests[0].url).toBe("/bookings/instapay");
    expect(requests[0].data).toBeInstanceOf(FormData);
    expect(requests[0].data.get("instaPayRefNumber")).toBe("123456789012");
    expect(requests[0].data.get("receipt").name).toBe("receipt.png");
    expect(requests[0].data.get("dateTime")).toBe("2099-01-05T09:00:00");
  });
  it("uses dedicated admin verification endpoints with an explicit decision", async () => {
    await instaPayApi.pending(); await instaPayApi.verify(42, false, "Reference not found");
    expect(requests.map((request) => [request.method, request.url])).toEqual([["get", "/admin/instapay-pending"], ["post", "/admin/bookings/42/verify-instapay"]]);
    expect(JSON.parse(requests[1].data)).toEqual({ approved: false, note: "Reference not found" });
  });
  it("rejects receipt URLs outside the private API path before making an authenticated request", async () => {
    await expect(instaPayApi.receipt("https://example.com/receipt.png")).rejects.toThrow("Invalid receipt URL");
    expect(requests).toHaveLength(0);
  });
  it("does not shift an offset-less schedule slot to UTC", () => {
    expect(toScheduleDateTime("2099-01-05", "09:00:00")).toBe("2099-01-05T09:00:00");
    expect(toScheduleDateTime("2099-01-05", "09:00")).toBe("2099-01-05T09:00:00");
    expect(() => toScheduleDateTime("2099-02-31", "09:00")).toThrow();
  });
});

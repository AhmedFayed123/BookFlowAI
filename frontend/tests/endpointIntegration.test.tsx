import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookingDetailsPage from "../src/app/bookings/[id]/page";
import CatalogPage from "../src/app/admin/catalog/page";
import BusinessPage from "../src/app/admin/business/page";

const mocks = vi.hoisted(() => ({ getBooking: vi.fn(), getProfile: vi.fn(), getReviews: vi.fn(), reschedule: vi.fn(), getSlots: vi.fn(), createReview: vi.fn(), getServices: vi.fn(), getCategories: vi.fn(), createService: vi.fn(), getInfo: vi.fn(), saveBusiness: vi.fn(), predict: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "42" }) }));
vi.mock("../src/components/auth/ProtectedRoute", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("../src/components/ui/WorkspaceShell", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("../src/components/ui/ToastProvider", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../src/lib/api", () => ({
  accountApi: { getProfile: mocks.getProfile }, bookingsApi: { getById: mocks.getBooking, reschedule: mocks.reschedule },
  reviewsApi: { getByStaff: mocks.getReviews, create: mocks.createReview }, staffApi: { getAvailableSlots: mocks.getSlots },
  servicesApi: { getServices: mocks.getServices, create: mocks.createService }, businessCategoriesApi: { getAll: mocks.getCategories }, adminApi: { updateBusinessAiData: mocks.saveBusiness },
  businessInfoApi: { getInfo: mocks.getInfo }, aiApi: { getPrediction: mocks.predict },
}));
describe("new endpoint-backed screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBooking.mockResolvedValue({ id: 42, serviceId: 1, serviceName: "Consultation", staffId: 2, staffName: "Maya", dateTime: "2099-01-04T09:00:00", durationInMinutes: 30, price: 100, status: "Pending" });
    mocks.getProfile.mockResolvedValue({ id: 5, name: "Customer", role: "Customer" });
    mocks.getReviews.mockResolvedValue([]);
    mocks.getSlots.mockResolvedValue([{ startTime: "09:00:00", endTime: "09:30:00", isAvailable: true }]);
    mocks.reschedule.mockResolvedValue({ message: "Rescheduled" });
    mocks.createReview.mockResolvedValue({ message: "Saved" });
    mocks.getServices.mockResolvedValue([]);
    mocks.getCategories.mockResolvedValue([{ id: 1, name: "Wellness", slug: "wellness", isActive: true }]);
    mocks.createService.mockResolvedValue({ id: 8 });
    mocks.getInfo.mockResolvedValue([]);
    mocks.saveBusiness.mockResolvedValue({ message: "Context saved" });
    mocks.predict.mockResolvedValue({ probability: 0.2, riskLevel: "Low", modelVersion: "fallback", isFallback: true });
  });
  afterEach(cleanup);

  it("submits business context with every required backend DTO field", async () => {
    const user = userEvent.setup(); render(<BusinessPage />);
    await user.type(await screen.findByLabelText("Business name"), "BookFlow Clinic");
    await user.type(screen.getByLabelText("Working hours"), "Monday 9 to 5");
    await user.type(screen.getByLabelText("Booking & cancellation policies"), "Cancel one day ahead");
    await user.click(screen.getByRole("button", { name: "Save business context" }));
    expect(mocks.saveBusiness).toHaveBeenCalledWith({ businessName: "BookFlow Clinic", industryCategory: "", workingHoursInfo: "Monday 9 to 5", policyInfo: "Cancel one day ahead", customInstructions: "", servicesSummary: "" });
    expect(mocks.toast).toHaveBeenCalledWith("Context saved", "success");
  });

  it("clearly labels fallback no-show estimates", async () => {
    const user = userEvent.setup(); render(<BusinessPage />);
    const customer = await screen.findByLabelText("Customer ID");
    await user.clear(customer); await user.type(customer, "5");
    await user.click(screen.getByRole("button", { name: "Get forecast" }));
    expect(await screen.findByText(/Fallback estimate, not a live model prediction/)).toBeInTheDocument();
    expect(mocks.predict).toHaveBeenCalledWith(expect.objectContaining({ customerId: 5, pastCancellationsCount: 0, isWeekend: false }));
  });

  it("selects live availability and submits a reschedule payload", async () => {
    const user = userEvent.setup(); render(<BookingDetailsPage />);
    fireEvent.change(await screen.findByLabelText("New date"), { target: { value: "2099-01-05" } });
    await user.selectOptions(await screen.findByLabelText("Available time"), "09:00:00");
    await user.click(screen.getByRole("button", { name: "Reschedule booking" }));
    expect(mocks.getSlots).toHaveBeenCalledWith(2, "2099-01-05", 1);
    expect(mocks.reschedule).toHaveBeenCalledWith(42, { newDateTime: "2099-01-05T09:00:00" });
    expect(mocks.toast).toHaveBeenCalledWith("Booking rescheduled.", "success");
  });
  it("offers a review only after completion", async () => {
    mocks.getBooking.mockResolvedValue({ id: 42, serviceId: 1, serviceName: "Consultation", staffId: 2, staffName: "Maya", dateTime: "2099-01-04T09:00:00", durationInMinutes: 30, price: 100, status: "Completed" });
    const user = userEvent.setup(); render(<BookingDetailsPage />);
    await user.type(await screen.findByLabelText("Comment"), "Great service");
    await user.click(screen.getByRole("button", { name: "Submit review" }));
    expect(mocks.createReview).toHaveBeenCalledWith({ bookingId: 42, rating: 5, comment: "Great service" });
    expect(await screen.findByText("You have reviewed this booking. Thank you.")).toBeInTheDocument();
  });
  it("creates a service with the selected category and exact DTO fields", async () => {
    const user = userEvent.setup(); render(<CatalogPage />);
    await user.type(await screen.findByLabelText("Service name"), "New consultation");
    await user.selectOptions(screen.getByLabelText("Category", { exact: true }), "1");
    await user.click(screen.getByRole("button", { name: "Save service" }));
    await waitFor(() => expect(mocks.createService).toHaveBeenCalledWith({ name: "New consultation", description: "", businessCategoryId: 1, price: 0, durationInMinutes: 30 }));
    expect(mocks.toast).toHaveBeenCalledWith("Service saved.", "success");
  });
});

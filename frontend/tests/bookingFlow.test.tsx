import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServiceList from "../src/components/booking/ServiceList";
import BookingModal from "../src/components/booking/BookingModal";
import { ToastProvider } from "../src/components/ui/ToastProvider";
import type { ServiceDto } from "../src/lib/api";

const apiMocks = vi.hoisted(() => ({
  getServices: vi.fn(),
  hasActiveSession: vi.fn(() => true),
  getStaff: vi.fn(),
  getAvailableSlots: vi.fn(),
  createBooking: vi.fn(),
}));

vi.mock("../src/lib/api", () => ({
  authStorage: { hasActiveSession: apiMocks.hasActiveSession },
  servicesApi: { getServices: apiMocks.getServices },
  staffApi: {
    getStaff: apiMocks.getStaff,
    getAvailableSlots: apiMocks.getAvailableSlots,
  },
  bookingsApi: { create: apiMocks.createBooking },
}));

const services: ServiceDto[] = [
  {
    id: 1,
    businessCategoryId: 10,
    businessCategoryName: "Wellness",
    name: "Consultation",
    description: "A personal assessment",
    price: 80,
    durationInMinutes: 45,
    isActive: true,
    bookingCount: 7,
  },
  {
    id: 2,
    businessCategoryId: 20,
    businessCategoryName: "Auto Care",
    name: "Vehicle inspection",
    description: "Full safety checks",
    price: 50,
    durationInMinutes: 30,
    isActive: true,
    bookingCount: 12,
  },
];

const renderWithToasts = (node: React.ReactNode) =>
  render(<ToastProvider>{node}</ToastProvider>);

describe("critical booking interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getServices.mockResolvedValue(services);
    apiMocks.getStaff.mockResolvedValue([
      {
        id: 8,
        userId: 12,
        name: "Amina Hassan",
        email: "amina@example.com",
        specialties: "Wellness specialist",
        workingHours: "9 AM – 5 PM",
        averageRating: 4.9,
        isAvailable: true,
      },
    ]);
    apiMocks.getAvailableSlots.mockResolvedValue([
      { startTime: "09:00:00", endTime: "09:45:00", isAvailable: true },
    ]);
    apiMocks.createBooking.mockResolvedValue({
      message: "Created",
      bookingId: 42,
    });
  });

  it("loads, searches, and clears service filters", async () => {
    const user = userEvent.setup();
    renderWithToasts(<ServiceList />);

    expect(await screen.findByText("Consultation")).toBeInTheDocument();
    await user.type(
      screen.getByRole("searchbox", { name: "Search services" }),
      "vehicle",
    );
    await waitFor(() =>
      expect(screen.queryByText("Consultation")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Vehicle inspection")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(await screen.findByText("Consultation")).toBeInTheDocument();
  });

  it("shows a recoverable service-loading error", async () => {
    const user = userEvent.setup();
    apiMocks.getServices
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(services);
    renderWithToasts(<ServiceList />);

    expect(
      await screen.findByText("We couldn’t load services"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Consultation")).toBeInTheDocument();
  });

  it("completes provider, slot, review, and confirmation steps", async () => {
    const user = userEvent.setup();
    renderWithToasts(
      <BookingModal service={services[0]} open onClose={vi.fn()} />,
    );

    await user.click(
      await screen.findByRole("button", { name: /Amina Hassan/ }),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getAllByRole("button", { name: /^Select .+/ })[1]);
    await user.click(
      await screen.findByRole("button", {
        name: "Select 09:00:00 to 09:45:00",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Price estimate")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    const totalDt = within(dialog).getByText("Estimated total");
    const totalDd = totalDt.parentElement?.querySelector("dd");
    expect(totalDd).toBeTruthy();
    expect(totalDd).toHaveTextContent("$80.00");
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(await screen.findByText("#42")).toBeInTheDocument();
    expect(apiMocks.createBooking).toHaveBeenCalledTimes(1);
  });
});

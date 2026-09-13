import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsProvider } from "../src/lib/useNotifications";
import NotificationCenter from "../src/components/ui/NotificationCenter";
import { appointmentLabel, bookingReminders, publishNotification, type AppNotification } from "../src/lib/notifications";

const mocks = vi.hoisted(() => ({ bookings: vi.fn(), all: vi.fn(), staff: vi.fn(), toast: vi.fn(), active: true }));
vi.mock("../src/hooks/useSignalR", () => ({ useSignalR: () => ({}) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("../src/lib/api", () => ({ authStorage: { hasActiveSession: () => mocks.active }, bookingsApi: { getMyBookings: mocks.bookings, getAll: mocks.all }, staffApi: { getMyBookings: mocks.staff } }));
vi.mock("../src/components/ui/ToastProvider", () => ({ useToast: () => ({ toast: mocks.toast }) }));

const upcoming = () => ({ id: 42, serviceName: "Consultation", dateTime: new Date(Date.now() + 3600000).toISOString(), status: "Confirmed" as const });
const account = (email = "customer@example.com", role = "Customer") => window.localStorage.setItem("bookflow_user", JSON.stringify({ email, role, name: "Nour" }));
const mount = (fixtures?: AppNotification[]) => render(<NotificationsProvider mockNotifications={fixtures}><NotificationCenter /></NotificationsProvider>);

beforeEach(() => {
  vi.clearAllMocks(); mocks.active = true; window.localStorage.clear(); account(); mocks.bookings.mockResolvedValue([]); mocks.all.mockResolvedValue([]); mocks.staff.mockResolvedValue([]);
});
afterEach(cleanup);

describe("reminder generation", () => {
  it("includes only pending or confirmed bookings in the next 48 hours", () => {
    const now = new Date("2026-09-12T12:00:00");
    const base = { id: 1, serviceName: "Haircut", dateTime: "2026-09-13T15:00:00", status: "Confirmed" as const };
    expect(bookingReminders([base, { ...base, id: 2, status: "Cancelled" }, { ...base, id: 3, dateTime: "2026-09-11T15:00:00" }, { ...base, id: 4, dateTime: "2026-09-17T15:00:00" }], now)).toHaveLength(1);
    expect(appointmentLabel(base.dateTime, now)).toContain("Tomorrow at");
  });
});

describe("notification center", () => {
  it("persists approval notifications and avoids duplicate success toasts on refresh", async () => {
    const booking = { ...upcoming(), dateTime: new Date(Date.now() + 7 * 86400000).toISOString(), paymentStatus: "Confirmed" };
    mocks.bookings.mockResolvedValue([booking]); mount();
    await userEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    expect(screen.getByText("InstaPay payment approved")).toBeVisible();
    expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining("payment and booking are confirmed"), "success");
    act(() => window.dispatchEvent(new Event("bookflow:bookings-changed")));
    await waitFor(() => expect(mocks.bookings.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("loads real reminders, opens the panel, and links to the booking", async () => {
    mocks.bookings.mockResolvedValue([upcoming()]); mount();
    const bell = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    await userEvent.click(bell);
    expect(screen.getByRole("dialog", { name: "Notification center" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Reminders" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View booking" })).toHaveAttribute("href", "/bookings/42");
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("persists read and dismissed reminders across refresh and remount", async () => {
    const booking = upcoming(); mocks.bookings.mockResolvedValue([booking]);
    const view = mount();
    await userEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    await userEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss: Your appointment is coming up" }));
    expect(screen.getByText("You’re all caught up")).toBeVisible();
    view.unmount(); mount();
    await waitFor(() => expect(mocks.bookings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await waitFor(() => expect(screen.getByText("You’re all caught up")).toBeVisible());
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("accepts booking confirmations, categorizes fixtures, and supports mark-all and Escape", async () => {
    const fixtures: AppNotification[] = [{ id: "old", kind: "system", title: "System notice", message: "A saved alert", createdAt: "2020-01-01T12:00:00Z" }];
    mount(fixtures);
    await screen.findByRole("button", { name: "Notifications, 1 unread" });
    act(() => publishNotification({ id: "created:9", kind: "booking", title: "Booking scheduled", message: "Your consultation was scheduled", bookingId: 9, createdAt: new Date().toISOString() }));
    await userEvent.click(screen.getByRole("button", { name: "Notifications, 2 unread" }));
    expect(within(screen.getByRole("region", { name: "Today" })).getByText("Booking scheduled")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Earlier" })).getByText("System notice")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveFocus();
    expect(mocks.bookings).not.toHaveBeenCalled();
  });

  it("shows a recoverable API error without generating mock appointments", async () => {
    mocks.bookings.mockRejectedValue(new Error("API temporarily unavailable")); mount();
    await waitFor(() => expect(mocks.bookings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("API temporarily unavailable");
    expect(screen.queryByText("Your appointment is coming up")).not.toBeInTheDocument();
    mocks.bookings.mockResolvedValue([upcoming()]);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Your appointment is coming up")).toBeVisible();
  });

  it("isolates notification histories and clears visible state when signed out", async () => {
    mocks.bookings.mockResolvedValue([upcoming()]); mount();
    await screen.findByRole("button", { name: "Notifications, 1 unread" });
    mocks.bookings.mockResolvedValue([]); account("other@example.com");
    act(() => window.dispatchEvent(new Event("storage")));
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible());
    expect(window.localStorage.getItem("bookflow:notifications:customer@example.com")).toContain("Consultation");
    mocks.active = false; window.localStorage.removeItem("bookflow_user");
    act(() => window.dispatchEvent(new Event("bookflow:profile-updated")));
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("You’re all caught up")).toBeVisible();
  });

  it("uses the staff schedule endpoint rather than customer bookings", async () => {
    account("staff@example.com", "Staff"); mount();
    await waitFor(() => expect(mocks.staff).toHaveBeenCalledTimes(2));
    expect(mocks.bookings).not.toHaveBeenCalled();
    expect(mocks.staff.mock.calls[1][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("removes a cancelled reminder after a booking-change event", async () => {
    const booking = upcoming(); mocks.bookings.mockResolvedValue([booking]); mount();
    await screen.findByRole("button", { name: "Notifications, 1 unread" });
    mocks.bookings.mockResolvedValue([{ ...booking, status: "Cancelled" }]);
    act(() => window.dispatchEvent(new Event("bookflow:bookings-changed")));
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible());
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("You’re all caught up")).toBeVisible();
  });

  it("uses admin bookings for administrators", async () => {
    account("admin@example.com", "Admin"); mocks.all.mockResolvedValue([upcoming()]); mount();
    await screen.findByRole("button", { name: "Notifications, 1 unread" });
    expect(mocks.all).toHaveBeenCalled(); expect(mocks.bookings).not.toHaveBeenCalled(); expect(mocks.staff).not.toHaveBeenCalled();
  });
});

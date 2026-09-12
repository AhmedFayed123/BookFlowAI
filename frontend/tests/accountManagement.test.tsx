import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "../src/app/account/page";
import AdminStaffPage from "../src/app/admin/staff/page";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  changePassword: vi.fn(),
  updateProfile: vi.fn(),
  getStaff: vi.fn(),
  getServices: vi.fn(),
  getTimeOffRequests: vi.fn(),
  createStaff: vi.fn(),
}));

vi.mock("../src/components/auth/ProtectedRoute", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../src/components/ui/WorkspaceShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../src/lib/api", () => ({
  accountApi: { getProfile: mocks.getProfile, changePassword: mocks.changePassword, updateProfile: mocks.updateProfile },
  adminApi: {
    getStaff: mocks.getStaff,
    getTimeOffRequests: mocks.getTimeOffRequests,
    createStaff: mocks.createStaff,
  },
  servicesApi: { getServices: mocks.getServices },
}));

vi.mock("../src/components/ui/ToastProvider", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("account and provider management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfile.mockResolvedValue({ id: 1, name: "Test Admin", email: "admin@example.com", role: "Admin" });
    mocks.changePassword.mockResolvedValue(true);
    mocks.updateProfile.mockResolvedValue(true);
    mocks.getStaff.mockResolvedValue([]);
    mocks.getTimeOffRequests.mockResolvedValue([]);
    mocks.getServices.mockResolvedValue([{ id: 1, name: "Consultation", businessCategoryName: "Wellness" }]);
    mocks.createStaff.mockResolvedValue({ id: 10 });
  });

  afterEach(cleanup);

  it("saves profile fields through the boolean-returning account endpoint", async () => {
    const user = userEvent.setup();
    render(<AccountPage />);
    const input = await screen.findByLabelText("Display name");
    await user.clear(input); await user.type(input, "Updated Admin");
    await user.type(screen.getByLabelText("Phone number"), "01012345678");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(mocks.updateProfile).toHaveBeenCalledWith({ name: "Updated Admin", phoneNumber: "01012345678" });
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("bookflow_user")!).name).toBe("Updated Admin"));
  });

  it("submits current and new passwords and clears sensitive fields", async () => {
    const user = userEvent.setup();
    render(<AccountPage />);
    await user.type(await screen.findByLabelText("Current password"), "Current@123");
    await user.type(screen.getByLabelText("New password"), "Changed@123");
    await user.type(screen.getByLabelText("Confirm new password"), "Changed@123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(mocks.changePassword).toHaveBeenCalledWith({ currentPassword: "Current@123", newPassword: "Changed@123" });
    expect(await screen.findByText("Password changed successfully.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  it("prevents a mismatched password confirmation", async () => {
    const user = userEvent.setup();
    render(<AccountPage />);
    await user.type(await screen.findByLabelText("Current password"), "Current@123");
    await user.type(screen.getByLabelText("New password"), "Changed@123");
    await user.type(screen.getByLabelText("Confirm new password"), "Mismatch@123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByText("New password and confirmation do not match.")).toBeInTheDocument();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("requires an assigned service before creating a provider", async () => {
    const user = userEvent.setup();
    render(<AdminStaffPage />);
    await screen.findByText("Consultation");
    await user.type(screen.getByPlaceholderText("Full name"), "New Provider");
    await user.type(screen.getByPlaceholderText("Email"), "provider@example.com");
    await user.type(screen.getByPlaceholderText("Temporary password"), "Provider@123");
    await user.click(screen.getByRole("button", { name: "Create provider" }));

    expect(screen.getByText("Select at least one service for this provider.")).toBeInTheDocument();
    expect(mocks.createStaff).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: /Consultation/ }));
    await user.click(screen.getByRole("button", { name: "Create provider" }));
    await waitFor(() => expect(mocks.createStaff).toHaveBeenCalledWith(expect.objectContaining({
      email: "provider@example.com",
      serviceIds: [1],
      shifts: [{ dayOfWeek: 1, startTime: "09:00:00", endTime: "17:00:00" }],
    })));
    expect(await screen.findByText("Staff member created successfully.")).toBeInTheDocument();
  });
});

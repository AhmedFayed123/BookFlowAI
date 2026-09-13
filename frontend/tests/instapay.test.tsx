import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import InstaPayCard from "../src/components/booking/InstaPayCard";
import InstaPayPage from "../src/app/admin/instapay/page";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), pending: vi.fn(), verify: vi.fn(), toast: vi.fn() }));
vi.mock("../src/lib/api", () => ({ instaPayApi: mocks }));
vi.mock("../src/components/auth/ProtectedRoute", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("../src/components/ui/WorkspaceShell", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("../src/components/ui/ToastProvider", () => ({ useToast: () => ({ toast: mocks.toast }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.settings.mockResolvedValue({ recipient: "bookflow@instapay", enabled: true });
  mocks.pending.mockResolvedValue([{ id: 42, customerName: "Mona", serviceName: "Consultation", staffName: "Amina", price: 80,
    dateTime: "2026-10-01T09:00:00", instaPayRefNumber: "123456789012", lockExpiresAt: "2026-10-01T08:30:00Z" }]);
  mocks.verify.mockResolvedValue({});
});

describe("InstaPay manual verification", () => {
  it("copies the business recipient and rejects unsupported receipt files", async () => {
    const user = userEvent.setup({ applyAccept: false }); const onReceipt = vi.fn(); const onReady = vi.fn();
    render(<InstaPayCard amount={80} reference="" receipt={null} onReference={vi.fn()} onReceipt={onReceipt} onReady={onReady} />);
    expect(await screen.findByText("bookflow@instapay")).toBeInTheDocument();
    expect(onReady).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe("bookflow@instapay");
    await user.upload(screen.getByLabelText("Transfer receipt screenshot"), new File(["receipt"], "receipt.png", { type: "image/png" }));
    expect(onReceipt).toHaveBeenCalledWith(expect.objectContaining({ name: "receipt.png" }));
    onReceipt.mockClear();
    await user.upload(screen.getByLabelText("Transfer receipt screenshot"), new File(["<script>"], "receipt.svg", { type: "image/svg+xml" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("PNG or JPEG");
    expect(onReceipt).not.toHaveBeenCalled();
  });
  it("disables checkout readiness when recipient is not configured", async () => {
    mocks.settings.mockResolvedValue({ recipient: null, enabled: false }); const onReady = vi.fn();
    render(<InstaPayCard amount={80} reference="" receipt={null} onReference={vi.fn()} onReceipt={vi.fn()} onReady={onReady} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
    expect(onReady).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
  });
  it.each([true, false])("submits admin decision approved=%s with its audit note", async (approved) => {
    const user = userEvent.setup(); render(<InstaPayPage />);
    expect(await screen.findByText("Mona")).toBeInTheDocument();
    expect(screen.getByText("123456789012")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Verification note"), "Checked business account");
    mocks.pending.mockResolvedValue([]);
    await user.click(screen.getByRole("button", { name: approved ? "Approve" : "Reject" }));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith(42, approved, "Checked business account"));
    expect(await screen.findByText("No transfers awaiting verification.")).toBeInTheDocument();
  });
  it("shows a stale review conflict and refreshes the queue", async () => {
    mocks.verify.mockRejectedValue(new Error("Already reviewed or expired"));
    const user = userEvent.setup(); render(<InstaPayPage />);
    await screen.findByText("Mona"); await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Already reviewed or expired", "error"));
    expect(mocks.pending).toHaveBeenCalledTimes(2);
  });
});

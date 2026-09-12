import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiChatWidget from "../src/components/chat/AiChatWidget";

const mocks = vi.hoisted(() => ({ sendChatMessage: vi.fn() }));
vi.mock("../src/lib/api", () => ({ aiApi: { sendChatMessage: mocks.sendChatMessage } }));

describe("integrated booking assistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.sendChatMessage.mockResolvedValue({ reply: "Choose a service, then a provider and time.", sessionId: "test-chat" });
  });
  afterEach(cleanup);

  it("restores conversation history without overwriting it on mount", async () => {
    const history = [{ role: "assistant", content: "Your saved conversation", timestamp: "2026-09-12T08:00:00Z" }];
    window.localStorage.setItem("bookflowai:chat:history", JSON.stringify(history));
    render(<AiChatWidget />);
    expect(await screen.findByText("Your saved conversation")).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("bookflowai:chat:history")!)).toEqual(history));
  });

  it("sends a suggested question and displays reply timing", async () => {
    const user = userEvent.setup();
    render(<AiChatWidget />);
    const question = screen.getByRole("button", { name: "How to book?" });
    await waitFor(() => expect(question).toBeEnabled());
    await user.click(question);
    expect(mocks.sendChatMessage).toHaveBeenCalledWith(expect.objectContaining({ message: "How to book?", businessId: 1 }));
    expect(await screen.findByText("Choose a service, then a provider and time.")).toBeInTheDocument();
    expect(screen.getByText(/Replied in/)).toBeInTheDocument();
  });

  it("shows typing status and disables duplicate requests", async () => {
    let resolveReply!: (value: { reply: string }) => void;
    mocks.sendChatMessage.mockImplementation(() => new Promise((resolve) => { resolveReply = resolve; }));
    const user = userEvent.setup();
    render(<AiChatWidget />);
    const question = screen.getByRole("button", { name: "Services available" });
    await waitFor(() => expect(question).toBeEnabled());
    await user.click(question);
    expect(screen.getByRole("status")).toHaveTextContent("Preparing your reply");
    expect(question).toBeDisabled();
    await act(async () => resolveReply({ reply: "Browse the service directory." }));
    expect(await screen.findByText("Browse the service directory.")).toBeInTheDocument();
  });

  it("collapses inline without creating a floating launcher", async () => {
    const user = userEvent.setup();
    render(<AiChatWidget />);
    await user.click(screen.getByRole("button", { name: "Collapse assistant" }));
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand assistant" })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "Expand assistant" }));
    expect(screen.getByRole("log")).toBeInTheDocument();
  });
});

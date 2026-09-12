import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AccountBadge from "../src/components/ui/AccountBadge";

afterEach(cleanup);

describe("account identity", () => {
  it("shows the signed-in name and role with a profile link", () => {
    render(<AccountBadge name="Nour Ahmed" role="Customer" />);
    expect(screen.getByText("Nour Ahmed")).toBeVisible();
    expect(screen.getByText("Customer")).toBeVisible();
    expect(screen.getByRole("link", { name: "Account: Nour Ahmed" })).toHaveAttribute("href", "/account");
    expect(screen.getByText("NA")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses an account fallback rather than inventing a user name", () => {
    render(<AccountBadge name="  " />);
    expect(screen.getByText("My account")).toBeVisible();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok", timestamp: new Date().toISOString() }),
    })
  );
});

describe("App", () => {
  it("renders the nav and defaults to the Dashboard route", async () => {
    render(<App />);

    expect(screen.getByText("SettleUp")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Connected/)).toBeInTheDocument();
    });
  });

  it("shows an error state when the backend is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Failed to fetch"))
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the backend");
    });
  });
});

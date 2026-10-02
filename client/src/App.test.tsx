import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";

function mockFetchByUrl(handlers: Record<string, { ok: boolean; status: number; body: unknown }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      const key = Object.keys(handlers).find((k) => url.includes(k));
      const res = key ? handlers[key] : { ok: false, status: 404, body: { error: { message: "not mocked" } } };
      return Promise.resolve({
        ok: res.ok,
        status: res.status,
        json: async () => res.body,
      });
    })
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  window.history.pushState({}, "", "/");
});

describe("App", () => {
  it("redirects an unauthenticated visitor to the login page", async () => {
    mockFetchByUrl({
      "/auth/me": { ok: false, status: 401, body: { error: { message: "Not authenticated" } } },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    });
  });

  it("shows the Dashboard for an authenticated user", async () => {
    const user = { id: "u1", email: "a@example.com", name: "Alice", createdAt: "2026-01-01" };
    mockFetchByUrl({
      "/auth/me": { ok: true, status: 200, body: { user } },
      "/groups": { ok: true, status: 200, body: { groups: [] } },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Welcome, Alice/ })).toBeInTheDocument();
    });
    expect(screen.getByText("SettleUp")).toBeInTheDocument();
  });
});

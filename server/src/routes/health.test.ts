import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.timestamp).toBe("string");
  });
});

describe("unknown route", () => {
  it("returns 404 with a structured error body", async () => {
    const app = createApp();
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain("Route not found");
  });
});

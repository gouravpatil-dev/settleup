import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { getDb, closeDb } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { extractSessionCookie } from "../test-utils/cookies.js";

const app = createApp();

beforeAll(() => {
  runMigrations(getDb());
});

afterAll(() => {
  closeDb();
});

describe("POST /api/auth/register", () => {
  it("creates a user and sets a session cookie, never returning the password hash", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "alice@example.com",
      name: "Alice",
      password: "correct-horse-battery",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("alice@example.com");
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(extractSessionCookie(res)).toMatch(/^sid=/);
  });

  it("rejects duplicate email registration", async () => {
    await request(app).post("/api/auth/register").send({
      email: "dupe@example.com",
      name: "Dupe",
      password: "correct-horse-battery",
    });

    const res = await request(app).post("/api/auth/register").send({
      email: "dupe@example.com",
      name: "Dupe Again",
      password: "another-password",
    });

    expect(res.status).toBe(409);
  });

  it("rejects invalid input (short password, bad email) with 400", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      name: "Bob",
      password: "short",
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    await request(app).post("/api/auth/register").send({
      email: "carol@example.com",
      name: "Carol",
      password: "correct-horse-battery",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "carol@example.com",
      password: "correct-horse-battery",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("carol@example.com");
    expect(extractSessionCookie(res)).toMatch(/^sid=/);
  });

  it("rejects an invalid password with 401", async () => {
    await request(app).post("/api/auth/register").send({
      email: "dave@example.com",
      name: "Dave",
      password: "correct-horse-battery",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "dave@example.com",
      password: "wrong-password",
    });

    expect(res.status).toBe(401);
  });

  it("rejects login for a non-existent email with the same 401 (no user enumeration)", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nobody@example.com",
      password: "whatever-password",
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me (protected)", () => {
  it("returns the current user when a valid session cookie is sent", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      email: "erin@example.com",
      name: "Erin",
      password: "correct-horse-battery",
    });
    const cookie = extractSessionCookie(registerRes);

    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("erin@example.com");
  });

  it("returns 401 with no session cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a garbage/forged session cookie", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", "sid=not-a-real-session");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("invalidates the session so it can no longer be used", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      email: "frank@example.com",
      name: "Frank",
      password: "correct-horse-battery",
    });
    const cookie = extractSessionCookie(registerRes);

    const logoutRes = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logoutRes.status).toBe(204);

    const meRes = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(meRes.status).toBe(401);
  });
});

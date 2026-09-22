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

async function registerUser(email: string, name: string) {
  const res = await request(app).post("/api/auth/register").send({
    email,
    name,
    password: "correct-horse-battery",
  });
  return { cookie: extractSessionCookie(res), user: res.body.user };
}

describe("GET /api/groups/:groupId/balances", () => {
  it("returns correct net balances after a single expense", async () => {
    const owner = await registerUser("bal-owner@example.com", "Bal Owner");
    const member = await registerUser("bal-member@example.com", "Bal Member");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Balance Group" });
    const groupId = groupRes.body.group.id;

    await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: member.user.email });

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Dinner",
        amount: 1000,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: owner.user.id }, { userId: member.user.id }],
      });

    const res = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(200);
    const ownerBalance = res.body.balances.find(
      (b: { userId: string }) => b.userId === owner.user.id
    );
    const memberBalance = res.body.balances.find(
      (b: { userId: string }) => b.userId === member.user.id
    );
    expect(ownerBalance.balance).toBe(500);
    expect(memberBalance.balance).toBe(-500);
  });

  it("nets multiple expenses across the group to zero total", async () => {
    const owner = await registerUser("bal2-owner@example.com", "Owner");
    const member = await registerUser("bal2-member@example.com", "Member");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Multi Expense Group" });
    const groupId = groupRes.body.group.id;

    await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: member.user.email });

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Dinner",
        amount: 1000,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: owner.user.id }, { userId: member.user.id }],
      });

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Movie",
        amount: 400,
        paidBy: member.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: owner.user.id }, { userId: member.user.id }],
      });

    const res = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(200);
    const total = res.body.balances.reduce(
      (s: number, b: { balance: number }) => s + b.balance,
      0
    );
    expect(total).toBe(0);
  });

  it("shows a zero balance for a member with no expenses", async () => {
    const owner = await registerUser("bal3-owner@example.com", "Owner");
    const idle = await registerUser("bal3-idle@example.com", "Idle Member");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Idle Member Group" });
    const groupId = groupRes.body.group.id;

    await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: idle.user.email });

    const res = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set("Cookie", owner.cookie);

    const idleBalance = res.body.balances.find(
      (b: { userId: string }) => b.userId === idle.user.id
    );
    expect(idleBalance.balance).toBe(0);
  });

  it("rejects a non-member requesting balances (404, not leaked)", async () => {
    const owner = await registerUser("bal4-owner@example.com", "Owner");
    const outsider = await registerUser("bal4-outsider@example.com", "Outsider");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Private Balance Group" });
    const groupId = groupRes.body.group.id;

    const res = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set("Cookie", outsider.cookie);

    expect(res.status).toBe(404);
  });

  it("rejects an unauthenticated request (401)", async () => {
    const owner = await registerUser("bal5-owner@example.com", "Owner");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "No Auth Balance Group" });
    const groupId = groupRes.body.group.id;

    const res = await request(app).get(`/api/groups/${groupId}/balances`);
    expect(res.status).toBe(401);
  });
});

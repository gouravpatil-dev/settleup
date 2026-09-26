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

describe("GET /api/groups/:groupId/settlements/plan", () => {
  it("reduces a group's expenses into a minimal settlement plan", async () => {
    const owner = await registerUser("settle-owner@example.com", "Owner");
    const memberB = await registerUser("settle-b@example.com", "Member B");
    const memberC = await registerUser("settle-c@example.com", "Member C");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Settlement Group" });
    const groupId = groupRes.body.group.id;

    for (const m of [memberB, memberC]) {
      await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set("Cookie", owner.cookie)
        .send({ email: m.user.email });
    }

    // Owner pays 900, split equally three ways (300 each) -> B and C
    // each owe the owner 300.
    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Trip expense",
        amount: 900,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [
          { userId: owner.user.id },
          { userId: memberB.user.id },
          { userId: memberC.user.id },
        ],
      });

    const res = await request(app)
      .get(`/api/groups/${groupId}/settlements/plan`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(2);

    const totalToOwner = res.body.transactions
      .filter((tx: { to: string }) => tx.to === owner.user.id)
      .reduce((s: number, tx: { amount: number }) => s + tx.amount, 0);
    expect(totalToOwner).toBe(600);

    for (const tx of res.body.transactions) {
      expect(tx.fromName).toBeTruthy();
      expect(tx.toName).toBe("Owner");
    }
  });

  it("returns an empty plan when the group is already settled", async () => {
    const owner = await registerUser("settle2-owner@example.com", "Owner");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Empty Settlement Group" });
    const groupId = groupRes.body.group.id;

    const res = await request(app)
      .get(`/api/groups/${groupId}/settlements/plan`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toEqual([]);
  });

  it("rejects a non-member requesting the settlement plan (404, not leaked)", async () => {
    const owner = await registerUser("settle3-owner@example.com", "Owner");
    const outsider = await registerUser("settle3-outsider@example.com", "Outsider");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Private Settlement Group" });
    const groupId = groupRes.body.group.id;

    const res = await request(app)
      .get(`/api/groups/${groupId}/settlements/plan`)
      .set("Cookie", outsider.cookie);

    expect(res.status).toBe(404);
  });

  it("rejects an unauthenticated request (401)", async () => {
    const owner = await registerUser("settle4-owner@example.com", "Owner");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "No Auth Settlement Group" });
    const groupId = groupRes.body.group.id;

    const res = await request(app).get(`/api/groups/${groupId}/settlements/plan`);
    expect(res.status).toBe(401);
  });
});

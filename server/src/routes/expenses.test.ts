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

async function createGroupWithMembers(ownerEmailPrefix: string) {
  const owner = await registerUser(`${ownerEmailPrefix}-owner@example.com`, "Owner");
  const memberB = await registerUser(`${ownerEmailPrefix}-b@example.com`, "Member B");
  const memberC = await registerUser(`${ownerEmailPrefix}-c@example.com`, "Member C");
  const memberD = await registerUser(`${ownerEmailPrefix}-d@example.com`, "Member D");

  const createRes = await request(app)
    .post("/api/groups")
    .set("Cookie", owner.cookie)
    .send({ name: `${ownerEmailPrefix} Group` });
  const groupId = createRes.body.group.id;

  for (const m of [memberB, memberC, memberD]) {
    await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: m.user.email });
  }

  return { groupId, owner, memberB, memberC, memberD };
}

describe("POST /api/groups/:groupId/expenses", () => {
  it("creates an equal-split expense", async () => {
    const { groupId, owner, memberB, memberC, memberD } = await createGroupWithMembers("eq");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Dinner",
        amount: 1000,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [
          { userId: owner.user.id },
          { userId: memberB.user.id },
          { userId: memberC.user.id },
          { userId: memberD.user.id },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.expense.amount).toBe(1000);
    expect(res.body.expense.participants).toHaveLength(4);
    const total = res.body.expense.participants.reduce(
      (s: number, p: { amount: number }) => s + p.amount,
      0
    );
    expect(total).toBe(1000);
  });

  it("creates an exact-split expense", async () => {
    const { groupId, owner, memberB, memberC, memberD } = await createGroupWithMembers("exact");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Groceries",
        amount: 1000,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "exact",
        participants: [
          { userId: owner.user.id, amount: 400 },
          { userId: memberB.user.id, amount: 300 },
          { userId: memberC.user.id, amount: 200 },
          { userId: memberD.user.id, amount: 100 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.expense.participants.find(
      (p: { userId: string }) => p.userId === owner.user.id
    ).amount).toBe(400);
  });

  it("rejects an exact split that doesn't sum to the total (400)", async () => {
    const { groupId, owner, memberB } = await createGroupWithMembers("exactbad");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Broken split",
        amount: 1000,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "exact",
        participants: [
          { userId: owner.user.id, amount: 400 },
          { userId: memberB.user.id, amount: 300 },
        ],
      });

    expect(res.status).toBe(400);
  });

  it("creates a percentage-split expense", async () => {
    const { groupId, owner, memberB, memberC, memberD } = await createGroupWithMembers("pct");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Rent",
        amount: 1000,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "percentage",
        participants: [
          { userId: owner.user.id, percentage: 40 },
          { userId: memberB.user.id, percentage: 30 },
          { userId: memberC.user.id, percentage: 20 },
          { userId: memberD.user.id, percentage: 10 },
        ],
      });

    expect(res.status).toBe(201);
    const total = res.body.expense.participants.reduce(
      (s: number, p: { amount: number }) => s + p.amount,
      0
    );
    expect(total).toBe(1000);
  });

  it("rejects percentages that don't add up to 100 (400)", async () => {
    const { groupId, owner, memberB } = await createGroupWithMembers("pctbad");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Broken percentage split",
        amount: 1000,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "percentage",
        participants: [
          { userId: owner.user.id, percentage: 40 },
          { userId: memberB.user.id, percentage: 40 },
        ],
      });

    expect(res.status).toBe(400);
  });

  it("creates a shares-split expense", async () => {
    const { groupId, owner, memberB, memberC } = await createGroupWithMembers("shares");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Cab fare",
        amount: 400,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "shares",
        participants: [
          { userId: owner.user.id, shares: 2 },
          { userId: memberB.user.id, shares: 1 },
          { userId: memberC.user.id, shares: 1 },
        ],
      });

    expect(res.status).toBe(201);
    const ownerShare = res.body.expense.participants.find(
      (p: { userId: string }) => p.userId === owner.user.id
    );
    expect(ownerShare.amount).toBe(200);
  });

  it("rejects a non-positive share count (400)", async () => {
    const { groupId, owner, memberB } = await createGroupWithMembers("sharesbad");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Broken shares split",
        amount: 1000,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "shares",
        participants: [
          { userId: owner.user.id, shares: 1 },
          { userId: memberB.user.id, shares: 0 },
        ],
      });

    expect(res.status).toBe(400);
  });

  it("rejects a participant who doesn't belong to the group (400)", async () => {
    const { groupId, owner } = await createGroupWithMembers("outsider-participant");
    const outsider = await registerUser("outsider-participant-x@example.com", "Outsider");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Sneaky expense",
        amount: 1000,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: owner.user.id }, { userId: outsider.user.id }],
      });

    expect(res.status).toBe(400);
  });

  it("rejects a payer who doesn't belong to the group (400)", async () => {
    const { groupId, owner } = await createGroupWithMembers("outsider-payer");
    const outsider = await registerUser("outsider-payer-x@example.com", "Outsider");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Sneaky payer",
        amount: 1000,
        paidBy: outsider.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: owner.user.id }],
      });

    expect(res.status).toBe(400);
  });

  it("rejects a non-positive total amount (400)", async () => {
    const { groupId, owner } = await createGroupWithMembers("badamount");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Free lunch?",
        amount: 0,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: owner.user.id }],
      });

    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated request (401)", async () => {
    const { groupId, owner } = await createGroupWithMembers("noauth");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .send({
        description: "No session",
        amount: 1000,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: owner.user.id }],
      });

    expect(res.status).toBe(401);
  });

  it("rejects a non-member of the group creating an expense (404, not leaked)", async () => {
    const { groupId } = await createGroupWithMembers("nonmember");
    const outsider = await registerUser("nonmember-x@example.com", "Outsider");

    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", outsider.cookie)
      .send({
        description: "Not my group",
        amount: 1000,
        paidBy: outsider.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: outsider.user.id }],
      });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/groups/:groupId/expenses", () => {
  it("lists expenses for a group member", async () => {
    const { groupId, owner } = await createGroupWithMembers("list");

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Coffee",
        amount: 200,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: owner.user.id }],
      });

    const res = await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.expenses).toHaveLength(1);
  });

  it("hides expenses from a non-member (404)", async () => {
    const { groupId } = await createGroupWithMembers("listhidden");
    const outsider = await registerUser("listhidden-x@example.com", "Outsider");

    const res = await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set("Cookie", outsider.cookie);

    expect(res.status).toBe(404);
  });
});

describe("GET /api/groups/:groupId/expenses/:expenseId", () => {
  it("returns a single expense with its participants", async () => {
    const { groupId, owner, memberB } = await createGroupWithMembers("getone");

    const createRes = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set("Cookie", owner.cookie)
      .send({
        description: "Snacks",
        amount: 600,
        paidBy: owner.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: owner.user.id }, { userId: memberB.user.id }],
      });
    const expenseId = createRes.body.expense.id;

    const res = await request(app)
      .get(`/api/groups/${groupId}/expenses/${expenseId}`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.expense.id).toBe(expenseId);
    expect(res.body.expense.participants).toHaveLength(2);
  });

  it("returns 404 for an expense id from a different group", async () => {
    const groupA = await createGroupWithMembers("crossa");
    const groupB = await createGroupWithMembers("crossb");

    const createRes = await request(app)
      .post(`/api/groups/${groupA.groupId}/expenses`)
      .set("Cookie", groupA.owner.cookie)
      .send({
        description: "Belongs to group A",
        amount: 100,
        paidBy: groupA.owner.user.id,
        date: "2026-09-20",
        splitType: "equal",
        participants: [{ userId: groupA.owner.user.id }],
      });
    const expenseId = createRes.body.expense.id;

    const res = await request(app)
      .get(`/api/groups/${groupB.groupId}/expenses/${expenseId}`)
      .set("Cookie", groupB.owner.cookie);

    expect(res.status).toBe(404);
  });
});

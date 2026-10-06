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

describe("GET /api/groups/:groupId/settlements/explanation", () => {
  it("explains the transformation from raw obligations to optimized transactions", async () => {
    const owner = await registerUser("explain-owner@example.com", "Owner");
    const memberB = await registerUser("explain-b@example.com", "Member B");
    const memberC = await registerUser("explain-c@example.com", "Member C");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Explanation Group" });
    const groupId = groupRes.body.group.id;

    for (const m of [memberB, memberC]) {
      await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set("Cookie", owner.cookie)
        .send({ email: m.user.email });
    }

    // Two 3-way equal-split expenses, each creating 2 raw obligations
    // (the payer owes nothing to themselves) -> 4 raw obligations total,
    // netting down to fewer final transactions.
    for (const desc of ["Dinner", "Cabs"]) {
      await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Cookie", owner.cookie)
        .send({
          description: desc,
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
    }

    const res = await request(app)
      .get(`/api/groups/${groupId}/settlements/explanation`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.rawObligationCount).toBe(4); // 2 expenses x 2 non-payer participants
    expect(res.body.optimizedTransactionCount).toBe(2); // B->owner, C->owner
    expect(res.body.optimizedTransactionCount).toBeLessThan(res.body.rawObligationCount);

    expect(res.body.creditors).toHaveLength(1);
    expect(res.body.creditors[0].userId).toBe(owner.user.id);
    expect(res.body.debtors).toHaveLength(2);

    expect(res.body.steps).toHaveLength(2);
    for (const step of res.body.steps) {
      expect(step.to).toBe(owner.user.id);
      expect(step.creditorRemainingAfter).toBe(step.creditorRemainingBefore - step.amount);
      expect(step.debtorRemainingAfter).toBe(0); // each debtor fully settles in one step here
    }
    expect(res.body.steps[0].step).toBe(1);
    expect(res.body.steps[1].step).toBe(2);
  });

  it("reflects a recorded settlement in the explanation (fewer obligations left)", async () => {
    const owner = await registerUser("explain2-owner@example.com", "Owner");
    const member = await registerUser("explain2-member@example.com", "Member");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Explanation Group 2" });
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
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", member.cookie)
      .send({
        fromUserId: member.user.id,
        toUserId: owner.user.id,
        amount: 500,
        date: "2026-09-21",
      });

    const res = await request(app)
      .get(`/api/groups/${groupId}/settlements/explanation`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.optimizedTransactionCount).toBe(0); // already settled
    expect(res.body.steps).toEqual([]);
  });

  it("rejects a non-member requesting the explanation (404, not leaked)", async () => {
    const owner = await registerUser("explain3-owner@example.com", "Owner");
    const outsider = await registerUser("explain3-outsider@example.com", "Outsider");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Private Explanation Group" });
    const groupId = groupRes.body.group.id;

    const res = await request(app)
      .get(`/api/groups/${groupId}/settlements/explanation`)
      .set("Cookie", outsider.cookie);

    expect(res.status).toBe(404);
  });

  it("rejects an unauthenticated request (401)", async () => {
    const owner = await registerUser("explain4-owner@example.com", "Owner");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "No Auth Explanation Group" });
    const groupId = groupRes.body.group.id;

    const res = await request(app).get(`/api/groups/${groupId}/settlements/explanation`);
    expect(res.status).toBe(401);
  });
});

async function setUpGroupWithDebt(prefix: string) {
  const owner = await registerUser(`${prefix}-owner@example.com`, "Owner");
  const member = await registerUser(`${prefix}-member@example.com`, "Member");

  const groupRes = await request(app)
    .post("/api/groups")
    .set("Cookie", owner.cookie)
    .send({ name: `${prefix} Group` });
  const groupId = groupRes.body.group.id;

  await request(app)
    .post(`/api/groups/${groupId}/members`)
    .set("Cookie", owner.cookie)
    .send({ email: member.user.email });

  // Owner pays 1000, split equally -> member owes owner 500.
  await request(app)
    .post(`/api/groups/${groupId}/expenses`)
    .set("Cookie", owner.cookie)
    .send({
      description: "Shared cost",
      amount: 1000,
      paidBy: owner.user.id,
      date: "2026-09-20",
      splitType: "equal",
      participants: [{ userId: owner.user.id }, { userId: member.user.id }],
    });

  return { owner, member, groupId };
}

describe("POST /api/groups/:groupId/settlements (mark as paid)", () => {
  it("records a full settlement and it reduces the balance to zero", async () => {
    const { owner, member, groupId } = await setUpGroupWithDebt("record-full");

    const recordRes = await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", member.cookie)
      .send({
        fromUserId: member.user.id,
        toUserId: owner.user.id,
        amount: 500,
        date: "2026-09-21",
      });
    expect(recordRes.status).toBe(201);
    expect(recordRes.body.settlement.fromName).toBe("Member");
    expect(recordRes.body.settlement.toName).toBe("Owner");

    const balancesRes = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set("Cookie", owner.cookie);
    const memberBalance = balancesRes.body.balances.find(
      (b: { userId: string }) => b.userId === member.user.id
    );
    expect(memberBalance.balance).toBe(0);

    const planRes = await request(app)
      .get(`/api/groups/${groupId}/settlements/plan`)
      .set("Cookie", owner.cookie);
    expect(planRes.body.transactions).toEqual([]);
  });

  it("records a partial settlement, leaving a residual balance", async () => {
    const { owner, member, groupId } = await setUpGroupWithDebt("record-partial");

    await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", member.cookie)
      .send({
        fromUserId: member.user.id,
        toUserId: owner.user.id,
        amount: 200,
        date: "2026-09-21",
      });

    const balancesRes = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set("Cookie", owner.cookie);
    const memberBalance = balancesRes.body.balances.find(
      (b: { userId: string }) => b.userId === member.user.id
    );
    expect(memberBalance.balance).toBe(-300); // owed 500, paid 200
  });

  it("rejects fromUserId === toUserId (400)", async () => {
    const { owner, groupId } = await setUpGroupWithDebt("record-self");

    const res = await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", owner.cookie)
      .send({
        fromUserId: owner.user.id,
        toUserId: owner.user.id,
        amount: 100,
        date: "2026-09-21",
      });
    expect(res.status).toBe(400);
  });

  it("rejects a fromUserId that isn't a group member (400)", async () => {
    const { owner, groupId } = await setUpGroupWithDebt("record-outsider");
    const outsider = await registerUser("record-outsider-x@example.com", "Outsider");

    const res = await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", owner.cookie)
      .send({
        fromUserId: outsider.user.id,
        toUserId: owner.user.id,
        amount: 100,
        date: "2026-09-21",
      });
    expect(res.status).toBe(400);
  });

  it("rejects a non-positive amount (400)", async () => {
    const { owner, member, groupId } = await setUpGroupWithDebt("record-badamount");

    const res = await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", owner.cookie)
      .send({
        fromUserId: member.user.id,
        toUserId: owner.user.id,
        amount: 0,
        date: "2026-09-21",
      });
    expect(res.status).toBe(400);
  });

  it("rejects a non-member recording a settlement (404, not leaked)", async () => {
    const { owner, groupId } = await setUpGroupWithDebt("record-nonmember");
    const outsider = await registerUser("record-nonmember-x@example.com", "Outsider");

    const res = await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", outsider.cookie)
      .send({
        fromUserId: outsider.user.id,
        toUserId: owner.user.id,
        amount: 100,
        date: "2026-09-21",
      });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/groups/:groupId/settlements (history)", () => {
  it("lists recorded settlements for the group", async () => {
    const { owner, member, groupId } = await setUpGroupWithDebt("history");

    await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", member.cookie)
      .send({
        fromUserId: member.user.id,
        toUserId: owner.user.id,
        amount: 500,
        date: "2026-09-21",
        note: "Paid via UPI",
      });

    const res = await request(app)
      .get(`/api/groups/${groupId}/settlements`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.settlements).toHaveLength(1);
    expect(res.body.settlements[0].note).toBe("Paid via UPI");
  });
});

describe("DELETE /api/groups/:groupId/settlements/:settlementId (mark as unpaid)", () => {
  it("lets the recorder undo their own settlement, restoring the balance", async () => {
    const { owner, member, groupId } = await setUpGroupWithDebt("undo-self");

    const recordRes = await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", member.cookie)
      .send({
        fromUserId: member.user.id,
        toUserId: owner.user.id,
        amount: 500,
        date: "2026-09-21",
      });
    const settlementId = recordRes.body.settlement.id;

    const deleteRes = await request(app)
      .delete(`/api/groups/${groupId}/settlements/${settlementId}`)
      .set("Cookie", member.cookie);
    expect(deleteRes.status).toBe(204);

    const balancesRes = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set("Cookie", owner.cookie);
    const memberBalance = balancesRes.body.balances.find(
      (b: { userId: string }) => b.userId === member.user.id
    );
    expect(memberBalance.balance).toBe(-500); // back to owing the full amount
  });

  it("lets the group owner undo a settlement they didn't record", async () => {
    const { owner, member, groupId } = await setUpGroupWithDebt("undo-owner");

    const recordRes = await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", member.cookie)
      .send({
        fromUserId: member.user.id,
        toUserId: owner.user.id,
        amount: 500,
        date: "2026-09-21",
      });
    const settlementId = recordRes.body.settlement.id;

    const deleteRes = await request(app)
      .delete(`/api/groups/${groupId}/settlements/${settlementId}`)
      .set("Cookie", owner.cookie);
    expect(deleteRes.status).toBe(204);
  });

  it("rejects a non-recorder, non-owner member undoing someone else's settlement (403)", async () => {
    const owner = await registerUser("undo-forbid-owner@example.com", "Owner");
    const memberA = await registerUser("undo-forbid-a@example.com", "Member A");
    const memberB = await registerUser("undo-forbid-b@example.com", "Member B");

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Undo Forbid Group" });
    const groupId = groupRes.body.group.id;

    for (const m of [memberA, memberB]) {
      await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set("Cookie", owner.cookie)
        .send({ email: m.user.email });
    }

    const recordRes = await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set("Cookie", memberA.cookie)
      .send({
        fromUserId: memberA.user.id,
        toUserId: owner.user.id,
        amount: 100,
        date: "2026-09-21",
      });
    const settlementId = recordRes.body.settlement.id;

    const deleteRes = await request(app)
      .delete(`/api/groups/${groupId}/settlements/${settlementId}`)
      .set("Cookie", memberB.cookie);
    expect(deleteRes.status).toBe(403);
  });

  it("returns 404 for a settlement id from a different group", async () => {
    const groupA = await setUpGroupWithDebt("undo-crossa");
    const groupB = await setUpGroupWithDebt("undo-crossb");

    const recordRes = await request(app)
      .post(`/api/groups/${groupA.groupId}/settlements`)
      .set("Cookie", groupA.member.cookie)
      .send({
        fromUserId: groupA.member.user.id,
        toUserId: groupA.owner.user.id,
        amount: 100,
        date: "2026-09-21",
      });
    const settlementId = recordRes.body.settlement.id;

    const deleteRes = await request(app)
      .delete(`/api/groups/${groupB.groupId}/settlements/${settlementId}`)
      .set("Cookie", groupB.owner.cookie);
    expect(deleteRes.status).toBe(404);
  });
});

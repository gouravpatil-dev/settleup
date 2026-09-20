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

describe("Group creation, ownership, and access control", () => {
  it("lets an authenticated user create a group and become its owner", async () => {
    const owner = await registerUser("owner1@example.com", "Owner One");

    const res = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Goa Trip" });

    expect(res.status).toBe(201);
    expect(res.body.group.name).toBe("Goa Trip");

    const membersRes = await request(app)
      .get(`/api/groups/${res.body.group.id}/members`)
      .set("Cookie", owner.cookie);

    expect(membersRes.status).toBe(200);
    expect(membersRes.body.members).toHaveLength(1);
    expect(membersRes.body.members[0].role).toBe("owner");
  });

  it("rejects unauthenticated group creation with 401", async () => {
    const res = await request(app).post("/api/groups").send({ name: "No Auth Group" });
    expect(res.status).toBe(401);
  });

  it("does not let a non-member view or access a group's details (404, not leaked)", async () => {
    const owner = await registerUser("owner2@example.com", "Owner Two");
    const outsider = await registerUser("outsider1@example.com", "Outsider One");

    const createRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Private Group" });
    const groupId = createRes.body.group.id;

    const res = await request(app)
      .get(`/api/groups/${groupId}`)
      .set("Cookie", outsider.cookie);

    expect(res.status).toBe(404);
  });

  it("lets an owner add a member by email, and the member can then view the group", async () => {
    const owner = await registerUser("owner3@example.com", "Owner Three");
    const member = await registerUser("member1@example.com", "Member One");

    const createRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Shared Group" });
    const groupId = createRes.body.group.id;

    const addRes = await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: "member1@example.com" });
    expect(addRes.status).toBe(201);
    expect(addRes.body.member.role).toBe("member");

    const viewRes = await request(app)
      .get(`/api/groups/${groupId}`)
      .set("Cookie", member.cookie);
    expect(viewRes.status).toBe(200);
  });

  it("rejects a non-owner member trying to rename or delete the group (403)", async () => {
    const owner = await registerUser("owner4@example.com", "Owner Four");
    const member = await registerUser("member2@example.com", "Member Two");

    const createRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Owned Group" });
    const groupId = createRes.body.group.id;

    await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: "member2@example.com" });

    const renameRes = await request(app)
      .patch(`/api/groups/${groupId}`)
      .set("Cookie", member.cookie)
      .send({ name: "Hijacked Name" });
    expect(renameRes.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/groups/${groupId}`)
      .set("Cookie", member.cookie);
    expect(deleteRes.status).toBe(403);
  });

  it("rejects a non-owner member trying to add or remove members (403)", async () => {
    const owner = await registerUser("owner5@example.com", "Owner Five");
    const member = await registerUser("member3@example.com", "Member Three");
    await registerUser("wouldbemember@example.com", "Would Be Member");

    const createRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Locked Down Group" });
    const groupId = createRes.body.group.id;

    await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: "member3@example.com" });

    const addRes = await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set("Cookie", member.cookie)
      .send({ email: "wouldbemember@example.com" });
    expect(addRes.status).toBe(403);
  });

  it("only lists groups the user actually belongs to", async () => {
    const userA = await registerUser("usera@example.com", "User A");
    const userB = await registerUser("userb@example.com", "User B");

    await request(app)
      .post("/api/groups")
      .set("Cookie", userA.cookie)
      .send({ name: "A's Group" });

    const listForB = await request(app).get("/api/groups").set("Cookie", userB.cookie);
    expect(listForB.status).toBe(200);
    expect(listForB.body.groups.every((g: { name: string }) => g.name !== "A's Group")).toBe(
      true
    );
  });

  it("prevents removing the last owner of a group", async () => {
    const owner = await registerUser("solo-owner@example.com", "Solo Owner");

    const createRes = await request(app)
      .post("/api/groups")
      .set("Cookie", owner.cookie)
      .send({ name: "Solo Group" });
    const groupId = createRes.body.group.id;

    const res = await request(app)
      .delete(`/api/groups/${groupId}/members/${owner.user.id}`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(403);
  });
});

import type Database from "better-sqlite3";
import { GroupRepository } from "../repositories/GroupRepository.js";
import { GroupMemberRepository } from "../repositories/GroupMemberRepository.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { ForbiddenError, NotFoundError, ConflictError } from "../utils/AppError.js";
import { requireGroupMembership } from "../utils/requireMembership.js";
import type { GroupMemberWithUser, GroupRow } from "../types/domain.js";

export class GroupService {
  private readonly groups: GroupRepository;
  private readonly members: GroupMemberRepository;
  private readonly users: UserRepository;

  constructor(db: Database.Database) {
    this.groups = new GroupRepository(db);
    this.members = new GroupMemberRepository(db);
    this.users = new UserRepository(db);
  }

  createGroup(params: { name: string; ownerId: string }): GroupRow {
    const group = this.groups.create({ name: params.name, createdBy: params.ownerId });
    this.members.add({ groupId: group.id, userId: params.ownerId, role: "owner" });
    return group;
  }

  listGroupsForUser(userId: string): GroupRow[] {
    return this.groups.listForUser(userId);
  }

  /** Throws NotFoundError if the group doesn't exist or the user isn't a member —
   *  deliberately the same error either way, so membership can't be probed for. */
  getGroupForMember(groupId: string, userId: string): GroupRow {
    const group = this.groups.findById(groupId);
    const membership = this.members.findMembership(groupId, userId);
    if (!group || !membership) {
      throw new NotFoundError("Group");
    }
    return group;
  }

  renameGroup(groupId: string, userId: string, name: string): GroupRow {
    this.requireOwner(groupId, userId);
    return this.groups.rename(groupId, name);
  }

  deleteGroup(groupId: string, userId: string): void {
    this.requireOwner(groupId, userId);
    this.groups.delete(groupId); // ON DELETE CASCADE removes memberships
  }

  listMembers(groupId: string, userId: string): GroupMemberWithUser[] {
    this.getGroupForMember(groupId, userId); // ensures requester is a member
    return this.members.listForGroup(groupId);
  }

  addMember(groupId: string, requesterId: string, memberEmail: string): GroupMemberWithUser {
    this.requireOwner(groupId, requesterId);

    const user = this.users.findByEmail(memberEmail);
    if (!user) {
      throw new NotFoundError("User with that email");
    }

    const existing = this.members.findMembership(groupId, user.id);
    if (existing) {
      throw new ConflictError("User is already a member of this group");
    }

    this.members.add({ groupId, userId: user.id, role: "member" });
    return this.members
      .listForGroup(groupId)
      .find((m) => m.userId === user.id)!;
  }

  removeMember(groupId: string, requesterId: string, targetUserId: string): void {
    this.requireOwner(groupId, requesterId);

    const target = this.members.findMembership(groupId, targetUserId);
    if (!target) {
      throw new NotFoundError("Membership");
    }

    if (target.role === "owner" && this.members.countOwners(groupId) <= 1) {
      throw new ForbiddenError("Cannot remove the last owner of a group");
    }

    this.members.remove(groupId, targetUserId);
  }

  private requireOwner(groupId: string, userId: string): void {
    requireGroupMembership(this.members, groupId, userId);
    const membership = this.members.findMembership(groupId, userId)!;
    if (membership.role !== "owner") {
      throw new ForbiddenError("Only the group owner can do this");
    }
  }
}

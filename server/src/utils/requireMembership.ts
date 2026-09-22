import type { GroupMemberRepository } from "../repositories/GroupMemberRepository.js";
import { NotFoundError } from "./AppError.js";

/**
 * Throws NotFoundError if userId is not a member of groupId. Deliberately
 * indistinguishable from "group doesn't exist" — never reveals whether
 * a group exists to someone who isn't in it.
 */
export function requireGroupMembership(
  members: GroupMemberRepository,
  groupId: string,
  userId: string
): void {
  if (!members.findMembership(groupId, userId)) {
    throw new NotFoundError("Group");
  }
}

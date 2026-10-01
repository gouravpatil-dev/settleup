import { apiFetch } from "./api";
import type { Group, GroupMember } from "../types";

export function listGroups(): Promise<{ groups: Group[] }> {
  return apiFetch("/groups");
}

export function createGroup(name: string): Promise<{ group: Group }> {
  return apiFetch("/groups", { method: "POST", body: JSON.stringify({ name }) });
}

export function getGroup(groupId: string): Promise<{ group: Group }> {
  return apiFetch(`/groups/${groupId}`);
}

export function renameGroup(groupId: string, name: string): Promise<{ group: Group }> {
  return apiFetch(`/groups/${groupId}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export function deleteGroup(groupId: string): Promise<void> {
  return apiFetch(`/groups/${groupId}`, { method: "DELETE" });
}

export function listMembers(groupId: string): Promise<{ members: GroupMember[] }> {
  return apiFetch(`/groups/${groupId}/members`);
}

export function addMember(groupId: string, email: string): Promise<{ member: GroupMember }> {
  return apiFetch(`/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function removeMember(groupId: string, userId: string): Promise<void> {
  return apiFetch(`/groups/${groupId}/members/${userId}`, { method: "DELETE" });
}

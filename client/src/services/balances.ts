import { apiFetch } from "./api";
import type { MemberBalance, SettlementTransaction } from "../types";

export function getGroupBalances(groupId: string): Promise<{ balances: MemberBalance[] }> {
  return apiFetch(`/groups/${groupId}/balances`);
}

export function getSettlementPlan(
  groupId: string
): Promise<{ transactions: SettlementTransaction[] }> {
  return apiFetch(`/groups/${groupId}/settlements/plan`);
}

import { apiFetch } from "./api";
import type { MemberBalance, Settlement, SettlementExplanation, SettlementTransaction } from "../types";

export function getGroupBalances(groupId: string): Promise<{ balances: MemberBalance[] }> {
  return apiFetch(`/groups/${groupId}/balances`);
}

export function getSettlementPlan(
  groupId: string
): Promise<{ transactions: SettlementTransaction[] }> {
  return apiFetch(`/groups/${groupId}/settlements/plan`);
}

export function listSettlementHistory(groupId: string): Promise<{ settlements: Settlement[] }> {
  return apiFetch(`/groups/${groupId}/settlements`);
}

export function recordSettlement(
  groupId: string,
  input: { fromUserId: string; toUserId: string; amount: number; date: string; note?: string }
): Promise<{ settlement: Settlement }> {
  return apiFetch(`/groups/${groupId}/settlements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getSettlementExplanation(groupId: string): Promise<SettlementExplanation> {
  return apiFetch(`/groups/${groupId}/settlements/explanation`);
}

export function deleteSettlement(groupId: string, settlementId: string): Promise<void> {
  return apiFetch(`/groups/${groupId}/settlements/${settlementId}`, { method: "DELETE" });
}

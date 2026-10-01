import { apiFetch } from "./api";
import type { Expense, SplitType } from "../types";

export type CreateExpenseParticipant =
  | { userId: string }
  | { userId: string; amount: number }
  | { userId: string; percentage: number }
  | { userId: string; shares: number };

export interface CreateExpenseInput {
  description: string;
  amount: number;
  currency?: string;
  paidBy: string;
  date: string;
  category?: string;
  notes?: string;
  splitType: SplitType;
  participants: CreateExpenseParticipant[];
}

export function listExpenses(groupId: string): Promise<{ expenses: Expense[] }> {
  return apiFetch(`/groups/${groupId}/expenses`);
}

export function getExpense(groupId: string, expenseId: string): Promise<{ expense: Expense }> {
  return apiFetch(`/groups/${groupId}/expenses/${expenseId}`);
}

export function createExpense(
  groupId: string,
  input: CreateExpenseInput
): Promise<{ expense: Expense }> {
  return apiFetch(`/groups/${groupId}/expenses`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

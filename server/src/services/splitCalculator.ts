import { ValidationError } from "../utils/AppError.js";
import type { SplitType } from "../types/domain.js";

export interface SplitResult {
  userId: string;
  amount: number;
  percentage: number | null;
  shares: number | null;
}

const PERCENTAGE_SUM_EPSILON = 0.01;

/**
 * Distributes `totalAmount` (an integer, e.g. minor currency units)
 * across participants in proportion to `weights`, guaranteeing the
 * result sums to exactly `totalAmount` — no floating-point drift.
 *
 * Each participant gets floor(totalAmount * weight / totalWeight);
 * the leftover units (always < participants.length) go one-by-one to
 * whoever had the largest fractional remainder, ties broken by input
 * order — the standard "largest remainder" apportionment method.
 */
function distributeByWeight(totalAmount: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const raw = weights.map((w) => (totalAmount * w) / totalWeight);
  const floors = raw.map(Math.floor);
  const allocated = floors.reduce((sum, f) => sum + f, 0);
  let remainder = totalAmount - allocated;

  const byRemainder = raw
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[byRemainder[k].i] += 1;
  }
  return result;
}

function assertPositiveIntegerAmount(totalAmount: number): void {
  if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
    throw new ValidationError("Expense amount must be a positive integer (minor currency units)");
  }
}

function assertNoDuplicateParticipants(userIds: string[]): void {
  const seen = new Set<string>();
  for (const id of userIds) {
    if (seen.has(id)) {
      throw new ValidationError("Duplicate participant in expense split", { userId: id });
    }
    seen.add(id);
  }
}

export function calculateEqualSplit(totalAmount: number, participantIds: string[]): SplitResult[] {
  assertPositiveIntegerAmount(totalAmount);
  if (participantIds.length === 0) {
    throw new ValidationError("An equal split needs at least one participant");
  }
  assertNoDuplicateParticipants(participantIds);

  const amounts = distributeByWeight(
    totalAmount,
    participantIds.map(() => 1)
  );

  return participantIds.map((userId, i) => ({
    userId,
    amount: amounts[i],
    percentage: null,
    shares: null,
  }));
}

export function calculateExactSplit(
  totalAmount: number,
  participants: Array<{ userId: string; amount: number }>
): SplitResult[] {
  assertPositiveIntegerAmount(totalAmount);
  if (participants.length === 0) {
    throw new ValidationError("An exact split needs at least one participant");
  }
  assertNoDuplicateParticipants(participants.map((p) => p.userId));

  for (const p of participants) {
    if (!Number.isInteger(p.amount) || p.amount < 0) {
      throw new ValidationError("Each exact split amount must be a non-negative integer", {
        userId: p.userId,
      });
    }
  }

  const sum = participants.reduce((s, p) => s + p.amount, 0);
  if (sum !== totalAmount) {
    throw new ValidationError("Exact split amounts must add up to the total expense amount", {
      expected: totalAmount,
      actual: sum,
    });
  }

  return participants.map((p) => ({
    userId: p.userId,
    amount: p.amount,
    percentage: null,
    shares: null,
  }));
}

export function calculatePercentageSplit(
  totalAmount: number,
  participants: Array<{ userId: string; percentage: number }>
): SplitResult[] {
  assertPositiveIntegerAmount(totalAmount);
  if (participants.length === 0) {
    throw new ValidationError("A percentage split needs at least one participant");
  }
  assertNoDuplicateParticipants(participants.map((p) => p.userId));

  for (const p of participants) {
    if (!(p.percentage > 0) || p.percentage > 100) {
      throw new ValidationError("Each percentage must be greater than 0 and at most 100", {
        userId: p.userId,
      });
    }
  }

  const sum = participants.reduce((s, p) => s + p.percentage, 0);
  if (Math.abs(sum - 100) > PERCENTAGE_SUM_EPSILON) {
    throw new ValidationError("Percentages must add up to 100", { actual: sum });
  }

  // Work in basis points (percentage * 100) to keep weights integer.
  const weights = participants.map((p) => Math.round(p.percentage * 100));
  const amounts = distributeByWeight(totalAmount, weights);

  return participants.map((p, i) => ({
    userId: p.userId,
    amount: amounts[i],
    percentage: p.percentage,
    shares: null,
  }));
}

export function calculateShareSplit(
  totalAmount: number,
  participants: Array<{ userId: string; shares: number }>
): SplitResult[] {
  assertPositiveIntegerAmount(totalAmount);
  if (participants.length === 0) {
    throw new ValidationError("A share split needs at least one participant");
  }
  assertNoDuplicateParticipants(participants.map((p) => p.userId));

  for (const p of participants) {
    if (!Number.isInteger(p.shares) || p.shares <= 0) {
      throw new ValidationError("Each share count must be a positive integer", {
        userId: p.userId,
      });
    }
  }

  const amounts = distributeByWeight(
    totalAmount,
    participants.map((p) => p.shares)
  );

  return participants.map((p, i) => ({
    userId: p.userId,
    amount: amounts[i],
    percentage: null,
    shares: p.shares,
  }));
}

export type SplitParticipantsInput =
  | { splitType: "equal"; participants: Array<{ userId: string }> }
  | { splitType: "exact"; participants: Array<{ userId: string; amount: number }> }
  | { splitType: "percentage"; participants: Array<{ userId: string; percentage: number }> }
  | { splitType: "shares"; participants: Array<{ userId: string; shares: number }> };

export function calculateSplit(totalAmount: number, input: SplitParticipantsInput): SplitResult[] {
  switch (input.splitType) {
    case "equal":
      return calculateEqualSplit(
        totalAmount,
        input.participants.map((p) => p.userId)
      );
    case "exact":
      return calculateExactSplit(totalAmount, input.participants);
    case "percentage":
      return calculatePercentageSplit(totalAmount, input.participants);
    case "shares":
      return calculateShareSplit(totalAmount, input.participants);
  }
}

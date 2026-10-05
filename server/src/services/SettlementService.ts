import type Database from "better-sqlite3";
import { BalanceService } from "./BalanceService.js";
import { SettlementRepository } from "../repositories/SettlementRepository.js";
import { GroupMemberRepository } from "../repositories/GroupMemberRepository.js";
import { requireGroupMembership } from "../utils/requireMembership.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../utils/AppError.js";
import { optimizeSettlements, type SettlementTransaction } from "../algorithm/settlementOptimizer.js";
import type { PublicSettlement } from "../types/domain.js";

export interface DisplaySettlementTransaction extends SettlementTransaction {
  fromName: string | null;
  toName: string | null;
}

export interface RecordSettlementInput {
  fromUserId: string;
  toUserId: string;
  amount: number;
  date: string;
  note?: string;
}

export class SettlementService {
  private readonly balances: BalanceService;
  private readonly settlements: SettlementRepository;
  private readonly members: GroupMemberRepository;

  constructor(db: Database.Database) {
    this.balances = new BalanceService(db);
    this.settlements = new SettlementRepository(db);
    this.members = new GroupMemberRepository(db);
  }

  getSettlementPlan(groupId: string, requesterId: string): DisplaySettlementTransaction[] {
    // getGroupBalances already enforces membership (404 for non-members).
    const groupBalances = this.balances.getGroupBalances(groupId, requesterId);

    const plan = optimizeSettlements(groupBalances);

    const nameByUserId = new Map(groupBalances.map((b) => [b.userId, b.name]));

    return plan.map((tx) => ({
      ...tx,
      fromName: nameByUserId.get(tx.from) ?? null,
      toName: nameByUserId.get(tx.to) ?? null,
    }));
  }

  private toPublic(row: {
    id: string;
    group_id: string;
    from_user_id: string;
    to_user_id: string;
    amount: number;
    settled_date: string;
    note: string | null;
    recorded_by: string;
    created_at: string;
  }): PublicSettlement {
    const memberInfo = this.members.listForGroup(row.group_id);
    const nameByUserId = new Map(memberInfo.map((m) => [m.userId, m.name]));
    return {
      id: row.id,
      groupId: row.group_id,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      amount: row.amount,
      date: row.settled_date,
      note: row.note,
      recordedBy: row.recorded_by,
      createdAt: row.created_at,
      fromName: nameByUserId.get(row.from_user_id) ?? null,
      toName: nameByUserId.get(row.to_user_id) ?? null,
    };
  }

  /** Records an actual payment ("mark as paid"). Does not touch expenses — a
   *  settlement is a separate concept, applied on top when balances are computed. */
  recordSettlement(
    groupId: string,
    requesterId: string,
    input: RecordSettlementInput
  ): PublicSettlement {
    requireGroupMembership(this.members, groupId, requesterId);

    if (!this.members.findMembership(groupId, input.fromUserId)) {
      throw new ValidationError("fromUserId must belong to the group", {
        userId: input.fromUserId,
      });
    }
    if (!this.members.findMembership(groupId, input.toUserId)) {
      throw new ValidationError("toUserId must belong to the group", { userId: input.toUserId });
    }

    const row = this.settlements.create({
      groupId,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      amount: input.amount,
      date: input.date,
      note: input.note,
      recordedBy: requesterId,
    });

    return this.toPublic(row);
  }

  listSettlementHistory(groupId: string, requesterId: string): PublicSettlement[] {
    requireGroupMembership(this.members, groupId, requesterId);
    return this.settlements.listForGroup(groupId).map((row) => this.toPublic(row));
  }

  /** "Mark as unpaid" — undoes a previously recorded settlement. Only the
   *  person who recorded it or the group owner can undo it. */
  deleteSettlement(groupId: string, requesterId: string, settlementId: string): void {
    requireGroupMembership(this.members, groupId, requesterId);

    const settlement = this.settlements.findById(settlementId);
    if (!settlement || settlement.group_id !== groupId) {
      throw new NotFoundError("Settlement");
    }

    const requesterMembership = this.members.findMembership(groupId, requesterId);
    const canDelete =
      settlement.recorded_by === requesterId || requesterMembership?.role === "owner";
    if (!canDelete) {
      throw new ForbiddenError("Only the person who recorded this settlement or the group owner can undo it");
    }

    this.settlements.delete(settlementId);
  }
}

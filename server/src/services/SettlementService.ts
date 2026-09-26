import type Database from "better-sqlite3";
import { BalanceService } from "./BalanceService.js";
import { optimizeSettlements, type SettlementTransaction } from "../algorithm/settlementOptimizer.js";

export interface DisplaySettlementTransaction extends SettlementTransaction {
  fromName: string | null;
  toName: string | null;
}

export class SettlementService {
  private readonly balances: BalanceService;

  constructor(db: Database.Database) {
    this.balances = new BalanceService(db);
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
}

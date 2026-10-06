import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import {
  getGroupBalances,
  getSettlementPlan,
  listSettlementHistory,
  recordSettlement,
  deleteSettlement,
} from "../services/balances";
import { getGroup, listMembers } from "../services/groups";
import { WhySettlement } from "../components/WhySettlement";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ApiError } from "../services/api";
import { formatCurrency, toMinorUnits, toMajorUnits } from "../utils/currency";
import type { SettlementTransaction } from "../types";

const today = new Date().toISOString().slice(0, 10);

async function fetchSettlementPageData(groupId: string) {
  const [groupRes, balancesRes, historyRes, membersRes] = await Promise.all([
    getGroup(groupId),
    getGroupBalances(groupId),
    listSettlementHistory(groupId),
    listMembers(groupId),
  ]);
  return {
    group: groupRes.group,
    balances: balancesRes.balances,
    history: historyRes.settlements,
    members: membersRes.members,
  };
}

export function Balances() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { data, loading, error, refetch } = useAsync(
    () => fetchSettlementPageData(groupId!),
    [groupId]
  );

  const [plan, setPlan] = useState<SettlementTransaction[] | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [markingKey, setMarkingKey] = useState<string | null>(null);
  const [markAmount, setMarkAmount] = useState("");
  const [markSubmitting, setMarkSubmitting] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  const [undoError, setUndoError] = useState<string | null>(null);

  if (loading) return <LoadingState label="Loading balances…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const { group, balances, history, members } = data;
  const sorted = [...balances].sort((a, b) => b.balance - a.balance);
  const isOwner = members.some((m) => m.userId === user?.id && m.role === "owner");

  async function handleOptimize() {
    if (!groupId) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await getSettlementPlan(groupId);
      setPlan(res.transactions);
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : "Could not compute a settlement plan");
    } finally {
      setPlanLoading(false);
    }
  }

  function startMarking(tx: SettlementTransaction) {
    const key = `${tx.from}-${tx.to}`;
    setMarkingKey(key);
    setMarkAmount(toMajorUnits(tx.amount).toFixed(2));
    setMarkError(null);
  }

  async function confirmMarkPaid(tx: SettlementTransaction) {
    if (!groupId) return;
    const rupees = parseFloat(markAmount);
    if (!rupees || rupees <= 0) {
      setMarkError("Enter an amount greater than zero");
      return;
    }
    setMarkSubmitting(true);
    setMarkError(null);
    try {
      await recordSettlement(groupId, {
        fromUserId: tx.from,
        toUserId: tx.to,
        amount: toMinorUnits(rupees),
        date: today,
      });
      setMarkingKey(null);
      setPlan(null); // stale now — re-optimize on next click
      refetch();
    } catch (err) {
      setMarkError(err instanceof ApiError ? err.message : "Could not record the settlement");
    } finally {
      setMarkSubmitting(false);
    }
  }

  async function handleUndo(settlementId: string) {
    if (!groupId) return;
    setUndoError(null);
    try {
      await deleteSettlement(groupId, settlementId);
      setPlan(null);
      refetch();
    } catch (err) {
      setUndoError(err instanceof ApiError ? err.message : "Could not undo this settlement");
    }
  }

  return (
    <div>
      <p>
        <Link to={`/groups/${groupId}`}>← {group.name}</Link>
      </p>
      <h1>Balances</h1>

      {balances.every((b) => b.balance === 0) && (
        <p className="empty-state">Everyone is settled up — no balances owed.</p>
      )}

      <ul className="balance-list">
        {sorted.map((b) => (
          <li key={b.userId} className={b.balance === 0 ? "" : b.balance > 0 ? "positive" : "negative"}>
            <span>{b.name ?? b.userId}</span>
            <span>
              {b.balance === 0
                ? "settled up"
                : b.balance > 0
                  ? `is owed ${formatCurrency(b.balance)}`
                  : `owes ${formatCurrency(Math.abs(b.balance))}`}
            </span>
          </li>
        ))}
      </ul>

      <section>
        <h2>Settle up</h2>
        {!plan && (
          <button type="button" onClick={handleOptimize} disabled={planLoading}>
            {planLoading ? "Calculating…" : "Optimize settlement"}
          </button>
        )}
        {planError && <ErrorState message={planError} />}

        {plan && plan.length === 0 && <p className="empty-state">Nothing to settle — everyone's even.</p>}

        {plan && plan.length > 0 && (
          <ul className="member-list">
            {plan.map((tx) => {
              const key = `${tx.from}-${tx.to}`;
              const isMarking = markingKey === key;
              return (
                <li key={key}>
                  <span>
                    {tx.fromName} owes {tx.toName} {formatCurrency(tx.amount)}
                  </span>
                  {!isMarking && (
                    <button type="button" onClick={() => startMarking(tx)}>
                      Mark as paid
                    </button>
                  )}
                  {isMarking && (
                    <span className="split-input-row">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        value={markAmount}
                        onChange={(e) => setMarkAmount(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => confirmMarkPaid(tx)}
                        disabled={markSubmitting}
                      >
                        {markSubmitting ? "Saving…" : "Confirm"}
                      </button>
                      <button type="button" onClick={() => setMarkingKey(null)}>
                        Cancel
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {markError && <ErrorState message={markError} />}
      </section>

      {groupId && <WhySettlement groupId={groupId} />}

      <section>
        <h2>Settlement history</h2>
        {history.length === 0 && <p className="empty-state">No settlements recorded yet.</p>}
        {history.length > 0 && (
          <ul className="member-list">
            {history.map((s) => (
              <li key={s.id}>
                <span>
                  {s.fromName} paid {s.toName} {formatCurrency(s.amount)} on {s.date}
                  {s.note && ` — ${s.note}`}
                </span>
                {(s.recordedBy === user?.id || isOwner) && (
                  <button type="button" onClick={() => handleUndo(s.id)}>
                    Mark as unpaid
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {undoError && <ErrorState message={undoError} />}
      </section>
    </div>
  );
}

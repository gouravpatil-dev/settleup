import { useState } from "react";
import { getSettlementExplanation } from "../services/balances";
import { ErrorState } from "./ErrorState";
import { ApiError } from "../services/api";
import { formatCurrency } from "../utils/currency";
import type { SettlementExplanation } from "../types";

export function WhySettlement({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SettlementExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !data) {
      setLoading(true);
      setError(null);
      try {
        const res = await getSettlementExplanation(groupId);
        setData(res);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load the explanation");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <section className="why-settlement">
      <button type="button" onClick={handleToggle} className="why-settlement-toggle">
        {open ? "▾" : "▸"} Why this settlement?
      </button>

      {open && loading && <p className="empty-state">Loading…</p>}
      {open && error && <ErrorState message={error} />}

      {open && data && (
        <div className="why-settlement-body">
          <p className="why-settlement-summary">
            Before optimization: <strong>{data.rawObligationCount}</strong> outstanding
            {data.rawObligationCount === 1 ? " obligation" : " obligations"} → After
            optimization: <strong>{data.optimizedTransactionCount}</strong>
            {data.optimizedTransactionCount === 1 ? " transaction" : " transactions"}
          </p>

          <div className="why-settlement-columns">
            <div>
              <h3>Creditors (owed money)</h3>
              {data.creditors.length === 0 && <p className="empty-state">None</p>}
              <ul>
                {data.creditors.map((c) => (
                  <li key={c.userId}>
                    {c.name} — owed {formatCurrency(c.balance)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Debtors (owe money)</h3>
              {data.debtors.length === 0 && <p className="empty-state">None</p>}
              <ul>
                {data.debtors.map((d) => (
                  <li key={d.userId}>
                    {d.name} — owes {formatCurrency(Math.abs(d.balance))}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <h3>Matching decisions</h3>
          {data.steps.length === 0 && (
            <p className="empty-state">Nothing to match — everyone's already settled.</p>
          )}
          {data.steps.length > 0 && (
            <ol className="why-settlement-steps">
              {data.steps.map((step) => (
                <li key={step.step}>
                  <strong>{step.fromName}</strong> pays <strong>{step.toName}</strong>{" "}
                  {formatCurrency(step.amount)} — {step.toName} was owed{" "}
                  {formatCurrency(step.creditorRemainingBefore)}, now owed{" "}
                  {formatCurrency(step.creditorRemainingAfter)}; {step.fromName} owed{" "}
                  {formatCurrency(step.debtorRemainingBefore)}, now owes{" "}
                  {formatCurrency(step.debtorRemainingAfter)}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

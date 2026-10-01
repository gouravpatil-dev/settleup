import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { getExpense } from "../services/expenses";
import { listMembers } from "../services/groups";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { formatCurrency } from "../utils/currency";

async function fetchExpenseDetails(groupId: string, expenseId: string) {
  const [expenseRes, membersRes] = await Promise.all([
    getExpense(groupId, expenseId),
    listMembers(groupId),
  ]);
  return { expense: expenseRes.expense, members: membersRes.members };
}

export function ExpenseDetails() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const { data, loading, error, refetch } = useAsync(
    () => fetchExpenseDetails(groupId!, expenseId!),
    [groupId, expenseId]
  );

  if (loading) return <LoadingState label="Loading expense…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const { expense, members } = data;
  const nameByUserId = new Map(members.map((m) => [m.userId, m.name]));

  return (
    <div>
      <p>
        <Link to={`/groups/${groupId}`}>← Back to group</Link>
      </p>
      <h1>{expense.description}</h1>

      <section className="stat-row">
        <div className="stat-card">
          <span className="stat-label">Amount</span>
          <span className="stat-value">{formatCurrency(expense.amount)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Paid by</span>
          <span className="stat-value">{nameByUserId.get(expense.paidBy) ?? "Unknown"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Date</span>
          <span className="stat-value">{expense.date}</span>
        </div>
      </section>

      {expense.category && (
        <p>
          <strong>Category:</strong> {expense.category}
        </p>
      )}
      {expense.notes && (
        <p>
          <strong>Notes:</strong> {expense.notes}
        </p>
      )}

      <section>
        <h2>Split ({expense.splitType})</h2>
        <ul className="member-list">
          {expense.participants.map((p) => (
            <li key={p.userId}>
              <span>{nameByUserId.get(p.userId) ?? p.userId}</span>
              <span>
                {formatCurrency(p.amount)}
                {p.percentage !== null && ` (${p.percentage}%)`}
                {p.shares !== null && ` (${p.shares} share${p.shares === 1 ? "" : "s"})`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

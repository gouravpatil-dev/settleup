import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { getGroup, listMembers, addMember, removeMember, deleteGroup } from "../services/groups";
import { listExpenses } from "../services/expenses";
import { getGroupBalances } from "../services/balances";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ApiError } from "../services/api";
import { formatCurrency } from "../utils/currency";

async function fetchGroupDetails(groupId: string) {
  const [groupRes, membersRes, expensesRes, balancesRes] = await Promise.all([
    getGroup(groupId),
    listMembers(groupId),
    listExpenses(groupId),
    getGroupBalances(groupId),
  ]);
  return {
    group: groupRes.group,
    members: membersRes.members,
    expenses: expensesRes.expenses,
    balances: balancesRes.balances,
  };
}

export function GroupDetails() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useAsync(() => fetchGroupDetails(groupId!), [groupId]);

  const [memberEmail, setMemberEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  if (loading) return <LoadingState label="Loading group…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const { group, members, expenses, balances } = data;
  const isOwner = members.some((m) => m.userId === user?.id && m.role === "owner");
  const totalSpending = expenses.reduce((sum, e) => sum + e.amount, 0);
  const recentExpenses = expenses.slice(0, 5);
  const settledCount = balances.filter((b) => b.balance === 0).length;
  const allSettled = balances.every((b) => b.balance === 0);

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (!memberEmail.trim() || !groupId) return;
    setAddingMember(true);
    setMemberError(null);
    try {
      await addMember(groupId, memberEmail.trim());
      setMemberEmail("");
      refetch();
    } catch (err) {
      setMemberError(err instanceof ApiError ? err.message : "Could not add member");
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!groupId) return;
    try {
      await removeMember(groupId, userId);
      refetch();
    } catch (err) {
      setMemberError(err instanceof ApiError ? err.message : "Could not remove member");
    }
  }

  async function handleDeleteGroup() {
    if (!groupId) return;
    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
    try {
      await deleteGroup(groupId);
      navigate("/groups", { replace: true });
    } catch (err) {
      setMemberError(err instanceof ApiError ? err.message : "Could not delete group");
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>{group.name}</h1>
        <div className="page-actions">
          <Link to={`/groups/${groupId}/expenses/new`}>
            <button type="button">Add expense</button>
          </Link>
          {isOwner && (
            <button type="button" className="danger" onClick={handleDeleteGroup}>
              Delete group
            </button>
          )}
        </div>
      </div>

      <section className="stat-row">
        <div className="stat-card">
          <span className="stat-label">Total spending</span>
          <span className="stat-value">{formatCurrency(totalSpending)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Settlement status</span>
          <span className="stat-value">
            {allSettled ? "All settled up" : `${settledCount} of ${balances.length} settled`}
          </span>
          <Link to={`/groups/${groupId}/balances`}>View balances →</Link>
        </div>
      </section>

      <section>
        <h2>Recent expenses</h2>
        {recentExpenses.length === 0 && (
          <p className="empty-state">No expenses yet. Add the first one above.</p>
        )}
        {recentExpenses.length > 0 && (
          <ul className="expense-list">
            {recentExpenses.map((expense) => (
              <li key={expense.id}>
                <Link to={`/groups/${groupId}/expenses/${expense.id}`}>
                  <span>{expense.description}</span>
                  <span>{formatCurrency(expense.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {expenses.length > 5 && <p className="empty-state">Showing 5 most recent of {expenses.length}.</p>}
      </section>

      <section>
        <h2>Members</h2>
        <ul className="member-list">
          {members.map((member) => (
            <li key={member.id}>
              <span>
                {member.name} {member.role === "owner" && <em>(owner)</em>}
              </span>
              {isOwner && member.role !== "owner" && (
                <button type="button" onClick={() => handleRemoveMember(member.userId)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {isOwner && (
          <form className="inline-form" onSubmit={handleAddMember}>
            <input
              type="email"
              placeholder="Member's email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
            />
            <button type="submit" disabled={addingMember || !memberEmail.trim()}>
              {addingMember ? "Adding…" : "Add member"}
            </button>
          </form>
        )}
        {memberError && <ErrorState message={memberError} />}
      </section>
    </div>
  );
}

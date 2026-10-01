import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { getGroupBalances } from "../services/balances";
import { getGroup } from "../services/groups";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { formatCurrency } from "../utils/currency";

async function fetchBalancesPageData(groupId: string) {
  const [groupRes, balancesRes] = await Promise.all([getGroup(groupId), getGroupBalances(groupId)]);
  return { group: groupRes.group, balances: balancesRes.balances };
}

export function Balances() {
  const { groupId } = useParams<{ groupId: string }>();
  const { data, loading, error, refetch } = useAsync(
    () => fetchBalancesPageData(groupId!),
    [groupId]
  );

  if (loading) return <LoadingState label="Loading balances…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const { group, balances } = data;
  const sorted = [...balances].sort((a, b) => b.balance - a.balance);

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
    </div>
  );
}

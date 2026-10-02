import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { listGroups } from "../services/groups";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";

export function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useAsync(listGroups, []);

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p>Here's a quick look at your groups.</p>

      {loading && <LoadingState label="Loading your groups…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {data && data.groups.length === 0 && (
        <div className="status-card">
          <p className="empty-state">You're not in any groups yet.</p>
          <Link to="/groups">Create your first group</Link>
        </div>
      )}

      {data && data.groups.length > 0 && (
        <ul className="group-summary-list">
          {data.groups.slice(0, 5).map((group) => (
            <li key={group.id}>
              <Link to={`/groups/${group.id}`}>{group.name}</Link>
            </li>
          ))}
        </ul>
      )}

      {data && data.groups.length > 0 && (
        <p>
          <Link to="/groups">View all groups →</Link>
        </p>
      )}
    </div>
  );
}

import { useAsync } from "../hooks/useAsync";
import { getHealth } from "../services/api";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";

export function Dashboard() {
  const { data, loading, error, refetch } = useAsync(getHealth, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome to SettleUp. Groups, balances, and settlements will appear here.</p>

      <section className="status-card">
        <h2>Backend status</h2>
        {loading && <LoadingState label="Checking backend connection…" />}
        {error && <ErrorState message={`Could not reach the backend: ${error}`} onRetry={refetch} />}
        {data && (
          <p>
            Connected — status <strong>{data.status}</strong> as of{" "}
            {new Date(data.timestamp).toLocaleTimeString()}
          </p>
        )}
      </section>
    </div>
  );
}

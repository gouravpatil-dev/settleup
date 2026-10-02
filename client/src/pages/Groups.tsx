import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { listGroups, createGroup } from "../services/groups";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ApiError } from "../services/api";

export function Groups() {
  const { data, loading, error, refetch } = useAsync(listGroups, []);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createGroup(name.trim());
      setName("");
      refetch();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Could not create the group");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1>Groups</h1>

      <form className="inline-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="New group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
        <button type="submit" disabled={creating || !name.trim()}>
          {creating ? "Creating…" : "Create group"}
        </button>
      </form>
      {createError && <ErrorState message={createError} />}

      {loading && <LoadingState label="Loading groups…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {data && data.groups.length === 0 && (
        <p className="empty-state">No groups yet — create one above to get started.</p>
      )}

      {data && data.groups.length > 0 && (
        <ul className="group-list">
          {data.groups.map((group) => (
            <li key={group.id} className="group-list-item">
              <Link to={`/groups/${group.id}`}>{group.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

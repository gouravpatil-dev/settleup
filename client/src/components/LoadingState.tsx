export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state state-loading" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

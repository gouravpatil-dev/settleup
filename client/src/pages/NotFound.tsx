import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="state state-error">
      <h1>404</h1>
      <p>That page doesn't exist.</p>
      <Link to="/">Back to Dashboard</Link>
    </div>
  );
}

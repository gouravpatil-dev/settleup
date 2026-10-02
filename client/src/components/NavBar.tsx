import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">SettleUp</div>
      {user && (
        <ul className="navbar-links">
          <li>
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/groups" className={({ isActive }) => (isActive ? "active" : "")}>
              Groups
            </NavLink>
          </li>
        </ul>
      )}
      <div className="navbar-spacer" />
      {user && (
        <div className="navbar-user">
          <span>{user.name}</span>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}

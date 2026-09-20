import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/groups", label: "Groups" },
];

export function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">SettleUp</div>
      <ul className="navbar-links">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to} end={link.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

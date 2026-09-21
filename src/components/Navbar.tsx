import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Library' },
  { to: '/stats', label: 'Stats' },
  { to: '/achievements', label: 'Achievements' },
  { to: '/settings', label: 'Settings' },
];

export function Navbar() {
  return (
    <nav className="gv-nav" aria-label="Main">
      <a href="#/" className="gv-logo" aria-label="Game Vault home">
        <span className="gv-logo-mark" aria-hidden />
        <span className="gv-logo-text">GAME<span className="gv-logo-accent">VAULT</span></span>
      </a>
      <div className="gv-nav-links">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className="gv-nav-link" end={l.to === '/'}>
            {l.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

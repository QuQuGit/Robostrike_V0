import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { LogOut, Globe, Mail } from "lucide-react";
import { CONTACT_EMAIL } from "../i18n_extra";

export default function Header() {
  const { t, lang, toggleLang } = useI18n();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  if (!user || loc.pathname === "/sandbox" || loc.pathname.startsWith("/room/")) return null;

  const links = [
    { to: "/home", label: t("nav.home") },
    { to: "/sandbox", label: t("nav.sandbox") },
    { to: "/lobby", label: t("nav.lobby") },
    { to: "/leaderboard", label: t("nav.leaderboard") },
    { to: "/profile", label: t("nav.profile") },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0d0d10] border-b border-border" data-testid="main-header">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-6">
        <Link to="/home" className="font-display font-black text-lg text-[#f97316] tracking-widest">
          ROBO<span className="text-white">STRIKE</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={`nav-${l.to.slice(1)}`}
              className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-sm transition-colors ${
                loc.pathname === l.to
                  ? "text-[#f97316] bg-[#f97316]/10"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            data-testid="nav-contact"
            className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-white"
          >
            <Mail size={14} /> <span className="hidden sm:inline">{t("nav.contact")}</span>
          </a>
          <button
            data-testid="lang-toggle"
            onClick={toggleLang}
            className="flex items-center gap-1 text-xs font-mono-rs text-muted-foreground hover:text-white"
          >
            <Globe size={14} /> {lang.toUpperCase()}
          </button>
          <span className="hidden sm:block font-mono-rs text-xs text-muted-foreground">
            {user.username} · L{user.level}
          </span>
          <button
            data-testid="logout-btn"
            onClick={() => { logout(); nav("/"); }}
            className="text-muted-foreground hover:text-red-400"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

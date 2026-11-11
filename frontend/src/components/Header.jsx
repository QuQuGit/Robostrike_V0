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
          <span className="text-xs text-muted-foreground">
            <span className="hidden sm:inline">Version : 0.01(préversion)</span>
            <span className="sm:hidden">V0.01</span>
          </span>
          <a
            href="https://discord.gg/N2VKK2Aw2v"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="nav-discord"
            aria-label="Discord"
            className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/>
            </svg>
            <span className="hidden sm:inline">Discord</span>
          </a>
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

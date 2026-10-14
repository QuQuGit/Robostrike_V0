import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { Swords, Users, Trophy, User } from "lucide-react";

export default function Home() {
  const { t } = useI18n();
  const { user } = useAuth();

  const cards = [
    { to: "/sandbox", icon: Swords, title: t("nav.sandbox"), desc: t("home.sandboxDesc"), cta: t("home.play"), primary: true },
    { to: "/lobby", icon: Users, title: t("nav.lobby"), desc: t("home.lobbyDesc"), cta: t("home.open") },
    { to: "/leaderboard", icon: Trophy, title: t("nav.leaderboard"), desc: t("home.leaderboardDesc"), cta: t("home.open") },
    { to: "/profile", icon: User, title: t("nav.profile"), desc: t("home.profileDesc"), cta: t("home.open") },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-10" data-testid="home-page">
      <h1 className="font-display text-3xl sm:text-4xl mb-2">
        {t("home.welcome", { name: user?.username })}
      </h1>
      <p className="text-muted-foreground mb-10 font-mono-rs text-sm">
        {t("app.tagline")}
      </p>
      <div className="grid sm:grid-cols-2 gap-5">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            data-testid={`home-card-${c.to.slice(1)}`}
            className="rs-panel rounded-sm p-6 group hover:-translate-y-1 transition-transform"
            style={{ borderColor: c.primary ? "rgba(249,115,22,0.4)" : undefined }}
          >
            <c.icon className={c.primary ? "text-[#f97316]" : "text-[#8b5cf6]"} size={28} />
            <h2 className="font-display text-xl mt-4 mb-1">{c.title}</h2>
            <p className="text-sm text-muted-foreground mb-4">{c.desc}</p>
            <span className={`font-mono-rs text-xs uppercase tracking-widest ${c.primary ? "text-[#f97316]" : "text-[#8b5cf6]"}`}>
              {c.cta} →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

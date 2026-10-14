import React from "react";
import { useI18n } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { User, Zap, Swords, Trophy, Skull } from "lucide-react";

export default function Profile() {
  const { t } = useI18n();
  const { user } = useAuth();
  if (!user) return null;
  const s = user.stats || {};
  const xpInLevel = user.xp % 100;

  const stats = [
    { icon: Swords, label: t("profile.games"), value: s.games || 0 },
    { icon: Trophy, label: t("profile.wins"), value: s.wins || 0 },
    { icon: Zap, label: t("profile.kills"), value: s.kills || 0 },
    { icon: Skull, label: t("profile.deaths"), value: s.deaths || 0 },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10" data-testid="profile-page">
      <h1 className="font-display text-3xl mb-8 flex items-center gap-2">
        <User className="text-[#f97316]" /> {t("profile.title")}
      </h1>
      <div className="rs-panel rounded-sm p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-sm bg-[#f97316] flex items-center justify-center font-display font-black text-2xl text-black">
            {user.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-display text-xl">{user.username}</p>
            <p className="font-mono-rs text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-display text-3xl text-[#f97316]">L{user.level}</p>
            <p className="font-mono-rs text-xs text-muted-foreground">{t("profile.level")}</p>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between font-mono-rs text-xs text-muted-foreground mb-1">
            <span>{t("profile.xp")}</span>
            <span>{user.xp} XP</span>
          </div>
          <div className="h-2 bg-[#1c1c22] rounded-sm overflow-hidden">
            <div className="h-full bg-[#8b5cf6]" style={{ width: `${xpInLevel}%` }} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((st, i) => (
          <div key={i} className="rs-panel rounded-sm p-4 text-center" data-testid={`stat-${i}`}>
            <st.icon className="text-[#8b5cf6] mx-auto mb-2" size={20} />
            <p className="font-display text-2xl">{st.value}</p>
            <p className="font-mono-rs text-[10px] uppercase tracking-wider text-muted-foreground">{st.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

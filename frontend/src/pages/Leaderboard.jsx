import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { Trophy } from "lucide-react";

export default function Leaderboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get("/leaderboard").then((r) => setRows(r.data));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10" data-testid="leaderboard-page">
      <h1 className="font-display text-3xl mb-8 flex items-center gap-2">
        <Trophy className="text-[#f97316]" /> {t("leaderboard.title")}
      </h1>
      {rows.length === 0 ? (
        <p className="text-muted-foreground font-mono-rs text-sm">{t("leaderboard.empty")}</p>
      ) : (
        <div className="rs-panel rounded-sm overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 border-b border-border font-mono-rs text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="col-span-2">{t("leaderboard.rank")}</span>
            <span className="col-span-7">{t("leaderboard.player")}</span>
            <span className="col-span-1 text-center">{t("profile.level")}</span>
            <span className="col-span-2 text-right">XP</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              data-testid={`lb-row-${r.rank}`}
              className={`grid grid-cols-12 px-4 py-3 items-center border-b border-border/50 ${
                r.id === user?.id ? "bg-[#f97316]/5" : ""
              }`}
            >
              <span className={`col-span-2 font-display ${r.rank <= 3 ? "text-[#f97316]" : ""}`}>
                #{r.rank}
              </span>
              <span className="col-span-7 flex items-center gap-2">
                {r.username}
                {r.id === user?.id && <span className="text-[10px] font-mono-rs text-[#8b5cf6]">YOU</span>}
              </span>
              <span className="col-span-1 text-center font-mono-rs text-sm">{r.level}</span>
              <span className="col-span-2 text-right font-mono-rs text-sm text-[#f97316]">{r.xp}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

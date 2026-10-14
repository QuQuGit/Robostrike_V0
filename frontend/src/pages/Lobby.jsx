import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { Users, Swords } from "lucide-react";

export default function Lobby() {
  const { t } = useI18n();
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center" data-testid="lobby-page">
      <Users className="text-[#8b5cf6] mx-auto mb-6" size={48} />
      <h1 className="font-display text-3xl mb-4">{t("lobby.soon")}</h1>
      <p className="text-muted-foreground mb-8">{t("lobby.soonDesc")}</p>
      <Link
        to="/sandbox"
        data-testid="lobby-to-sandbox"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-sm bg-[#f97316] text-black font-bold uppercase tracking-widest text-sm hover:bg-[#ea580c]"
      >
        <Swords size={16} /> {t("nav.sandbox")}
      </Link>
    </div>
  );
}

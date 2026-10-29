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
            <span className={`font-mono-rs text-xs uppercase tracking-widest ${c.primary ? "text-[#f97316]" : "text-[#8b5cf6]"`}>
              {c.cta} →
            </span>
          </Link>
        ))}
      </div>

      {/* NOUVELLE SECTION : NOTE DE VERSION */}
      <div className="mt-12 p-6 rounded-sm bg-[#1a1a1a] border border-border/30">
        <h2 className="font-display text-lg text-[#f97316] mb-3">📌 Version Préliminaire</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Ce site est actuellement en <strong>première préversion</strong>. La prochaine mise à jour majeure est prévue pour <strong>début décembre 2026</strong>.
        </p>

        <h3 className="font-mono-rs text-xs uppercase tracking-wider text-[#8b5cf6] mb-2">Feuille de route</h3>
        <div className="space-y-3">
          <div>
            <h4 className="font-mono-rs text-xs text-muted-foreground mb-1">🎮 Déploiement & Plateformes</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 ml-3">
              <li>Confirmation des déploiements sur Steam, Android et iOS</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono-rs text-xs text-muted-foreground mb-1">⚙️ Moteur : Corrections de bugs</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 ml-3">
              <li>Placement des bombes</li>
              <li>Icône des lasers doubles</li>
              <li>Invisibilité au 1er tour après réapparition</li>
              <li>Autres corrections mineures</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono-rs text-xs text-muted-foreground mb-1">⚡ Moteur : Évolutions</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 ml-3">
              <li>Mouvement précis près des murs</li>
              <li>Revue des animations d'explosion (blast)</li>
              <li>Placement des actions en fonction des boosts (impossibilité de finir par un boost)</li>
              <li>Changement de l'icône de rotation après un boost pour une translation</li>
              <li>Gestion de 8 robots simultanés</li>
              <li>Points de départ et gestion des superpositions</li>
              <li>Ordre des actions en fonction de l'ordre de validation</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono-rs text-xs text-muted-foreground mb-1">🗺️ Cartes & Gameplay</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 ml-3">
              <li>Génération de cartes par IA à la volée</li>
              <li>Visualisation miniature de la carte à la création de partie</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono-rs text-xs text-muted-foreground mb-1">👥 Multijoueur</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 ml-3">
              <li>Refonte du lobby pour afficher l'ensemble des joueurs connectés</li>
              <li>Ajout d'un chat global</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono-rs text-xs text-muted-foreground mb-1">🏆 Classement & Statistiques</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 ml-3">
              <li>Mise en place d'un classement de type "Skills" (inspiré Xbox)</li>
              <li>Écrans de résumé en fin de partie</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono-rs text-xs text-muted-foreground mb-1">🎯 Nouveaux Modes de Jeu</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 ml-3">
              <li>Mode "Course"</li>
              <li>Mode solo "Puzzle"</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono-rs text-xs text-muted-foreground mb-1">🛠️ Outils & Contenu</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 ml-3">
              <li>Création d'un éditeur de carte</li>
              <li>Ajout d'un tutorial interactif</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

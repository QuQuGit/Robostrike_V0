# Robostrike Clone — PRD

## Problem statement (original, FR)
Clone fidèle de Robostrike : jeu web multijoueur de programmation de robots sur grille vue de dessus.
Chaque joueur programme 6 actions à l'avance, résolution simultanée côté serveur. Mode principal : deathmatch.
Cible visuelle : plateau métallique sombre, convoyeurs violets fléchés, lasers oranges, trous noirs, robots colorés.
Déploiement cible : Vercel (front) + Render (back WebSockets) + MongoDB Atlas.

## User choices (V1)
- Priorité : **Sandbox admin (2 robots, pas à pas) + moteur complet**
- Auth : **JWT custom** (email + mot de passe)
- Règles : **3 vies, 5 PV**. Armes : laser (1), double laser (2), blast (1), bombe (3). Dernier robot debout + plafond de temps.
- Langue : **FR + EN**
- Chat : oui (phase multijoueur)

## Architecture
- Frontend React (JS/JSX, craco), Canvas 2D maison pour le plateau, Tailwind + shadcn, i18n FR/EN maison.
- Backend FastAPI, moteur de jeu 100% serveur-autoritatif (`game_engine.py`), stateless pour la sandbox.
- MongoDB : collection `users` (auth, xp, stats). Boards codés en dur (`boards.py`).
- Auth JWT (Bearer token en localStorage `rs_token`).

## Personas
- **Pilote** : joue, programme ses robots, monte en XP/niveau.
- **Admin** : utilise la sandbox pour tester/équilibrer le moteur pas à pas.

## Core requirements (static)
- Moteur : résolution slot par slot (6 slots × 4 phases : tirs → déplacements → effets plateau → résolution).
- Règles : mouvement/rotation/turbo, poussée en chaîne, armes directionnelles bloquées par murs/robots, blast adjacent, bombe portée 3, bouclier (slot courant), trous mortels, convoyeurs, lasers de plateau, respawn avec invulnérabilité, élimination après 3 morts.
- Dégâts calculés sur l'état de début de slot.

## Implemented (2026-06, iter 1)
- [x] Auth JWT : register / login / me ; seed admin idempotent.
- [x] Moteur de jeu complet serveur-autoritatif (`game_engine.py`) — 24 tests pytest OK.
- [x] 3 plateaux faits main : foundry, cross, arena.
- [x] Sandbox admin : 2–6 robots, programmation par clic, résolution animée, lecture/pas-à-pas (24 frames), nouveau tour.
- [x] Rendu Canvas 2D : grille métallique, convoyeurs violets fléchés, lasers oranges, trous noirs, murs, robots colorés + tourelle, bouclier/invuln, barres de PV, vies.
- [x] Pages : Landing, Home, Profil (XP/niveau/stats), Classement, Lobby (placeholder).
- [x] i18n FR/EN avec bascule.

## Backlog (prioritized)
### P0 (next)
- Multijoueur temps réel : WebSockets, salons/lobby, salle d'attente, timer 30s, synchro d'état, reconnexion.
- Chat texte dans les salons.
- Attribution XP + stats après partie (wins/kills/deaths), écran de fin.
### P1
- Drag & drop des cartes (tactile) en complément du clic.
- Système de main de cartes aléatoires (comme l'original) au lieu de la palette illimitée.
- Sons / feedbacks, effets d'explosion et particules.
- Pushers (poussoirs) et plus d'éléments de plateau.
### P2
- Déploiement Vercel + Render + MongoDB Atlas (CORS, env, WebSocket persistant).
- Plus de plateaux, éditeur de plateau, replays sauvegardés en base (`matches`).

## Notes
- Lobby multijoueur = **placeholder** assumé en V1 (non implémenté), conformément à la priorité "sandbox + moteur d'abord".
- Credentials de test : voir /app/memory/test_credentials.md

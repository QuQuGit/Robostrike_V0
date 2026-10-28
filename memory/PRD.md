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

## Visual rework v2 (2026-06, iter 2) — mockup-faithful, AWAITING USER VALIDATION
- Illustrated sprites in /app/frontend/public/assets (robot_red/blue/green/yellow.png, floor.jpg, pit.jpg, machinery.jpg), generated then cut out.
- GameCanvas: metal pipe frame + purple/orange neon side tubes, steel-plate tiles, square pits, continuous purple tube conveyors (corners, moving ribs, chevrons), emitters set into the frame with live orange beams that stop at walls/robots, steel wall bars, robot sprites + colored brackets, blue shield bubble, projected path of the programmed move (ghost).
- Sandbox layout: 'ROBOSTRIKE' title plate, 'Phase de programmation / Tour' bar, playback tab under the board, robot plates (orange HP bar + heart), card console (colored card tray + 6 neon slots: purple = movement/defence, orange = weapons).
- Testing: iteration_2 frontend 100% (flows + mobile 390 without overflow).
- Known issue: header nav links are hidden on mobile (no hamburger menu).

## Iteration 3 (2026-06) — rules + game screen, tested (iteration_3: backend 50/50 after fix, frontend OK)
- Default hand: forward, backward, left, right, laser, blast, boost (turbo). U-turn removed.
- Boost: no effect in its own slot. Each stacked boost adds +1 cell to the next move; left/right after a boost becomes a lateral move (1+n cells) with no rotation. Weapons and items cannot follow a boost (greyed in the UI, ignored by the server, and the item is not consumed).
- Pickups on fixed cells: bomb, double_laser and shield go to robot.items as one-use cards; life restores 5 HP. A picked item is greyed for the rest of the turn and comes back next turn (frames[].taken).
- Turntables: board.rotators, rot = +1 (right) / -1 (left), applied in the board phase after conveyors.
- Destroyed robot: dead=true, hidden from the board, remaining actions cancelled. It respawns in the final 'respawn' frame with 5 HP and is invulnerable for the next turn. Explosion effect on death.
- Visuals: full-cell conveyors (rails, moving slats, chevrons, rollers), burst icon for Blast, turntables and pickups drawn on the canvas, rolling treads, recoil and muzzle flash.
- Game screen: site header hidden on /sandbox, compact toolbar (exit, board, robots, reset, FR/EN), everything fits on one desktop screen, smaller cards and slots.

## Iteration 4 (2026-06)
- A destroyed robot (killed or fallen) loses all its items.
- Projected movement path removed from the board.
- Backend: 51/51 pytest.

## Iteration 5 (2026-06) — online matches (tested iter 4-5)
- Speed remembered in localStorage: rs_speed_sandbox (default ×1), rs_speed_online (default ×4).
- Animated popups on the canvas: +1 <item>, +N PV (life), -N PV (AFK penalty).
- Online: in-memory rooms (backend/rooms.py). REST GET/POST /api/rooms, GET /api/rooms/{code}; WS /api/ws/rooms/{code}?token=JWT.
  Lobby (list + create + join by code), ready / host settings / start (2-4 players), chat, 30s timer, live drafts + submit,
  1 dmg per empty slot ('penalty' frame, ignores invulnerability), replay_done sync, game over + draw + rematch (back to the room lobby). No XP (user choice).
- Known limits: rooms are lost if the backend restarts; single server process only.

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

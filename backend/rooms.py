"""Online rooms: in-memory, server-authoritative real-time matches over WebSocket."""
import asyncio
import random
import time

import boards as boards_mod
from game_engine import resolve_turn, SLOTS, ACTION_IDS

PROGRAM_SECONDS = 30
FRAME_SECONDS = 0.65
CHAT_KEEP = 50
ROOMS = {}
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _new_code():
    while True:
        code = "".join(random.choice(_ALPHABET) for _ in range(5))
        if code not in ROOMS:
            return code


def cleanup_rooms():
    now = time.time()
    for code in [c for c, r in ROOMS.items() if not r.players and now - r.created > 60]:
        ROOMS.pop(code, None)


def create_room(user, name, board_id, max_players):
    code = _new_code()
    room = Room(code, user, name, board_id, max_players)
    ROOMS[code] = room
    return room


class Room:
    def __init__(self, code, host, name, board_id, max_players):
        self.code = code
        self.name = (name or f"{host['username']}'s room")[:32]
        self.board_id = board_id
        self.max_players = max(2, min(4, max_players))
        self.host_id = host["id"]
        self.created = time.time()
        self.players = []
        self.sockets = {}
        self.status = "lobby"
        self.robots = []
        self.programs = {}
        self.deadline = None
        self.turn = 0
        self.chat = []
        self.replay_done = set()
        self.replay_event = asyncio.Event()
        self.winner = None

    # ---------------- views ----------------
    def player(self, uid):
        return next((p for p in self.players if p["user_id"] == uid), None)

    def summary(self):
        return {"code": self.code, "name": self.name, "board_id": self.board_id,
                "max_players": self.max_players, "players": len(self.players),
                "status": self.status, "host": self.player(self.host_id)["username"] if self.player(self.host_id) else None}

    def public(self):
        return {
            "code": self.code, "name": self.name, "board_id": self.board_id,
            "max_players": self.max_players, "host_id": self.host_id, "status": self.status,
            "turn": self.turn, "winner": self.winner,
            "seconds_left": max(0.0, self.deadline - time.time()) if self.deadline and self.status == "programming" else None,
            "players": [{**{k: p[k] for k in ("user_id", "username", "ready", "connected", "robot_id", "color")},
                         "submitted": bool(self.programs.get(p["user_id"], {}).get("final"))} for p in self.players],
            "robots": self.robots,
            "chat": self.chat,
        }

    async def send(self, uid, msg):
        ws = self.sockets.get(uid)
        if ws is None:
            return
        try:
            await ws.send_json(msg)
        except Exception:
            self.sockets.pop(uid, None)

    async def broadcast(self, msg):
        for uid in list(self.sockets):
            await self.send(uid, msg)

    async def push_state(self):
        await self.broadcast({"type": "room", "room": self.public()})

    # ---------------- membership ----------------
    async def join(self, user, ws):
        p = self.player(user["id"])
        if p is None:
            if self.status != "lobby":
                return "Game already started"
            if len(self.players) >= self.max_players:
                return "Room is full"
            self.players.append({"user_id": user["id"], "username": user["username"][:12],
                                 "ready": False, "connected": True, "robot_id": None, "color": None})
        else:
            p["connected"] = True
        old = self.sockets.get(user["id"])
        self.sockets[user["id"]] = ws
        if old is not None and old is not ws:
            try:
                await old.close()
            except Exception:
                pass
        await self.push_state()
        return None

    async def disconnect(self, uid, ws, leaving=False):
        if self.sockets.get(uid) is ws:
            self.sockets.pop(uid, None)
        elif not leaving:
            return
        p = self.player(uid)
        if p is None:
            return
        if self.status in ("lobby", "finished"):
            self.players.remove(p)
        else:
            p["connected"] = False
            self.replay_done.add(uid)
            self._check_replay()
        if self.host_id == uid and self.players:
            nxt = next((q for q in self.players if q["connected"]), self.players[0])
            self.host_id = nxt["user_id"]
        if not any(q["connected"] for q in self.players):
            ROOMS.pop(self.code, None)
            return
        await self.push_state()

    # ---------------- lobby ----------------
    async def handle(self, uid, msg):
        t = msg.get("type")
        if t == "chat":
            text = str(msg.get("text", "")).strip()[:200]
            if text:
                p = self.player(uid)
                entry = {"user": p["username"], "color": p["color"], "text": text, "ts": time.time()}
                self.chat = (self.chat + [entry])[-CHAT_KEEP:]
                await self.broadcast({"type": "chat", "msg": entry})
        elif t == "ready" and self.status == "lobby":
            self.player(uid)["ready"] = bool(msg.get("ready"))
            await self.push_state()
        elif t == "settings" and self.status == "lobby" and uid == self.host_id:
            if boards_mod.get_board(msg.get("board_id", "")):
                self.board_id = msg["board_id"]
            mp = int(msg.get("max_players", self.max_players))
            self.max_players = max(len(self.players), 2, min(4, mp))
            await self.push_state()
        elif t == "start" and uid == self.host_id and self.status in ("lobby", "finished"):
            await self.start(uid)
        elif t == "program" and self.status == "programming":
            await self.set_program(uid, msg.get("program"), bool(msg.get("final")))
        elif t == "replay_done" and self.status == "resolving":
            self.replay_done.add(uid)
            self._check_replay()

    async def start(self, uid):
        if self.status == "finished":
            self.status = "lobby"
            self.players = [p for p in self.players if p["connected"]]
            for p in self.players:
                p["ready"], p["robot_id"], p["color"] = False, None, None
            self.robots, self.turn, self.winner = [], 0, None
            await self.push_state()
            return
        if len(self.players) < 2 or not all(p["ready"] or p["user_id"] == self.host_id for p in self.players):
            await self.send(uid, {"type": "error", "detail": "not_ready"})
            return
        board = boards_mod.get_board(self.board_id)
        self.robots = []
        for i, p in enumerate(self.players):
            sp = board["spawns"][i]
            color = boards_mod.ROBOT_COLORS[i]
            p["robot_id"], p["color"] = f"R{i + 1}", color
            self.robots.append({
                "id": f"R{i + 1}", "name": p["username"], "color": color,
                "x": sp["x"], "y": sp["y"], "dir": sp["dir"], "hp": 5, "max_hp": 5, "lives": 3,
                "alive": True, "eliminated": False, "dead": False, "items": [], "invuln": False,
                "shield": False, "spawn": {"x": sp["x"], "y": sp["y"], "dir": sp["dir"]},
            })
        self.turn, self.winner = 0, None
        await self.broadcast({"type": "board", "board": board})
        await self.begin_programming()

    # ---------------- turn loop ----------------
    async def begin_programming(self):
        self.turn += 1
        self.programs = {}
        self.status = "programming"
        self.deadline = time.time() + PROGRAM_SECONDS
        asyncio.create_task(self._timer(self.turn))
        await self.push_state()

    async def _timer(self, turn):
        await asyncio.sleep(PROGRAM_SECONDS)
        if self.status == "programming" and self.turn == turn and ROOMS.get(self.code) is self:
            await self.resolve()

    def _active_uids(self):
        alive = {r["id"] for r in self.robots if not r.get("eliminated")}
        return [p["user_id"] for p in self.players if p["robot_id"] in alive]

    async def set_program(self, uid, program, final):
        if uid not in self._active_uids() or self.programs.get(uid, {}).get("final"):
            return
        prog = [a if a in ACTION_IDS else None for a in list(program or [])[:SLOTS]]
        prog += [None] * (SLOTS - len(prog))
        self.programs[uid] = {"program": prog, "final": final}
        if final:
            await self.push_state()
            if all(self.programs.get(u, {}).get("final") for u in self._active_uids()):
                asyncio.create_task(self.resolve())

    async def resolve(self):
        if self.status != "programming":
            return
        self.status = "resolving"
        self.deadline = None
        board = boards_mod.get_board(self.board_id)
        by_robot = {p["robot_id"]: self.programs.get(p["user_id"], {}).get("program") or [None] * SLOTS
                    for p in self.players}
        payload = []
        for r in self.robots:
            prog = by_robot.get(r["id"], [None] * SLOTS)
            payload.append({**r, "program": prog, "penalty": sum(1 for a in prog if a is None)})
        result = resolve_turn(board, payload)
        self.robots = result["robots"]
        self.replay_done = {p["user_id"] for p in self.players if not p["connected"]}
        self.replay_event = asyncio.Event()
        await self.broadcast({"type": "turn_result", "turn": self.turn, "frames": result["frames"],
                              "robots": result["robots"], "game_over": result["game_over"],
                              "winner": result["winner"]})
        await self.push_state()
        try:
            await asyncio.wait_for(self.replay_event.wait(), timeout=len(result["frames"]) * FRAME_SECONDS + 3)
        except asyncio.TimeoutError:
            pass
        if ROOMS.get(self.code) is not self:
            return
        if result["game_over"]:
            self.status = "finished"
            self.winner = next((p["username"] for p in self.players if p["robot_id"] == result["winner"]), None)
            for p in self.players:
                p["ready"] = False
            await self.push_state()
        else:
            await self.begin_programming()

    def _check_replay(self):
        if self.status == "resolving" and all(p["user_id"] in self.replay_done for p in self.players):
            self.replay_event.set()

# Iteration 4: online rooms REST + WebSocket match flow
import asyncio
import json
import os
import time
import uuid

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WS_BASE = BASE_URL.replace("https", "wss").replace("http", "ws")


def login(email, pw, username=None):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200 and username:
        requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": pw, "username": username})
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def tokens():
    third = f"test_{uuid.uuid4().hex[:6]}@robostrike.com"
    return {
        "admin": login("admin@robostrike.com", "admin123"),
        "player": login("player@robostrike.com", "player123"),
        "third": login(third, "third123", f"T{uuid.uuid4().hex[:5]}"),
    }


def H(t):
    return {"Authorization": f"Bearer {t}"}


def create(t, **kw):
    body = {"name": "TEST_room", "board_id": "arena", "max_players": 2, **kw}
    r = requests.post(f"{BASE_URL}/api/rooms", json=body, headers=H(t))
    assert r.status_code == 200, r.text
    return r.json()


async def recv_until(ws, typ, pred=lambda m: True, n=200, timeout=45):
    for _ in range(n):
        m = json.loads(await asyncio.wait_for(ws.recv(), timeout))
        if m["type"] == typ and pred(m):
            return m
    raise AssertionError(f"no {typ}")


def wsurl(code, t):
    return f"{WS_BASE}/api/ws/rooms/{code}?token={t}"


# ---------- REST ----------
class TestRoomsRest:
    def test_list_requires_auth(self):
        assert requests.get(f"{BASE_URL}/api/rooms").status_code in (401, 403)

    def test_create_and_list(self, tokens):
        room = create(tokens["admin"], name="TEST_list", max_players=3)
        assert len(room["code"]) == 5 and room["status"] == "lobby" and room["max_players"] == 3
        assert room["name"] == "TEST_list"
        lst = requests.get(f"{BASE_URL}/api/rooms", headers=H(tokens["player"])).json()
        assert any(r["code"] == room["code"] for r in lst)
        g = requests.get(f"{BASE_URL}/api/rooms/{room['code'].lower()}", headers=H(tokens["player"]))
        assert g.status_code == 200 and g.json()["code"] == room["code"]

    def test_unknown_room_404(self, tokens):
        assert requests.get(f"{BASE_URL}/api/rooms/ZZZZ1", headers=H(tokens["admin"])).status_code == 404

    def test_bad_board_404(self, tokens):
        r = requests.post(f"{BASE_URL}/api/rooms", json={"board_id": "nope"}, headers=H(tokens["admin"]))
        assert r.status_code == 404

    def test_max_players_clamped(self, tokens):
        assert create(tokens["admin"], max_players=9)["max_players"] == 4
        assert create(tokens["admin"], max_players=1)["max_players"] == 2


# ---------- WebSocket ----------
class TestRoomsWs:
    def test_bad_token_and_unknown_room(self, tokens):
        async def run():
            room = create(tokens["admin"])
            async with websockets.connect(wsurl(room["code"], "bad")) as w:
                m = json.loads(await w.recv())
                assert m == {"type": "error", "detail": "auth"}
            async with websockets.connect(wsurl("ZZZZ9", tokens["admin"])) as w:
                m = json.loads(await w.recv())
                assert m["detail"] == "not_found"
        asyncio.run(run())

    def test_lobby_full_settings_leave(self, tokens):
        async def run():
            room = create(tokens["admin"])
            code = room["code"]
            async with websockets.connect(wsurl(code, tokens["admin"])) as a, websockets.connect(wsurl(code, tokens["player"])) as b:
                m = await recv_until(a, "room", lambda m: len(m["room"]["players"]) == 2)
                host = m["room"]["host_id"]
                # third user -> full
                async with websockets.connect(wsurl(code, tokens["third"])) as c:
                    e = json.loads(await c.recv())
                    assert e == {"type": "error", "detail": "Room is full"}
                # start without ready -> not_ready error to host
                await a.send(json.dumps({"type": "start"}))
                e = await recv_until(a, "error")
                assert e["detail"] == "not_ready"
                # non-host settings ignored, host settings applied
                await b.send(json.dumps({"type": "settings", "board_id": "factory", "max_players": 4}))
                await a.send(json.dumps({"type": "settings", "board_id": "arena", "max_players": 3}))
                m = await recv_until(a, "room", lambda m: m["room"]["max_players"] == 3)
                assert m["room"]["board_id"] == "arena"
                # guest leaves in lobby -> removed
                await b.send(json.dumps({"type": "leave"}))
                m = await recv_until(a, "room", lambda m: len(m["room"]["players"]) == 1)
                assert m["room"]["players"][0]["user_id"] == host
        asyncio.run(run())

    def test_full_match_penalty_and_turn2(self, tokens):
        async def run():
            code = create(tokens["admin"])["code"]
            async with websockets.connect(wsurl(code, tokens["admin"])) as a, websockets.connect(wsurl(code, tokens["player"])) as b:
                await recv_until(b, "room", lambda m: len(m["room"]["players"]) == 2)
                await b.send(json.dumps({"type": "ready", "ready": True}))
                await recv_until(a, "room", lambda m: all(p["ready"] for p in m["room"]["players"] if p["user_id"] != m["room"]["host_id"]) and len(m["room"]["players"]) == 2)
                await a.send(json.dumps({"type": "chat", "text": "TEST_hi"}))
                c = await recv_until(b, "chat")
                assert c["msg"]["text"] == "TEST_hi"
                await a.send(json.dumps({"type": "start"}))
                await recv_until(b, "board")
                m = await recv_until(b, "room", lambda m: m["room"]["status"] == "programming")
                assert m["room"]["turn"] == 1 and 27 <= m["room"]["seconds_left"] <= 30
                # third user cannot join a started game
                async with websockets.connect(wsurl(code, tokens["third"])) as c3:
                    assert json.loads(await c3.recv())["detail"] == "Game already started"
                # GET /rooms should not list it any more
                lst = requests.get(f"{BASE_URL}/api/rooms", headers=H(tokens["admin"])).json()
                assert all(r["code"] != code for r in lst)
                await a.send(json.dumps({"type": "program", "program": ["forward"], "final": False}))
                await a.send(json.dumps({"type": "program", "program": ["left", "forward", "forward", "right", "laser", "laser"], "final": True}))
                m = await recv_until(b, "room", lambda m: any(p["submitted"] for p in m["room"]["players"]))
                await b.send(json.dumps({"type": "program", "program": ["laser", "laser"], "final": True}))
                res = await recv_until(a, "turn_result")
                f0 = res["frames"][0]
                assert f0["phase"] == "penalty"
                assert f0["events"] == [{"t": "penalty", "robot": "Player", "dmg": 4}] or any(e.get("dmg") == 4 for e in f0["events"])
                await a.send(json.dumps({"type": "replay_done"}))
                await b.send(json.dumps({"type": "replay_done"}))
                t0 = time.time()
                m = await recv_until(a, "room", lambda m: m["room"]["status"] == "programming" and m["room"]["turn"] == 2, timeout=30)
                waited = time.time() - t0
                print("waited for turn 2:", round(waited, 1))
                assert all(not p["submitted"] for p in m["room"]["players"])
                # BUG: last submitter's socket loop is blocked inside resolve(), its replay_done is not read
                assert waited < 5, f"turn 2 only after replay timeout ({waited:.1f}s)"
        asyncio.run(run())

    def test_afk_timeout_auto_resolve(self, tokens):
        async def run():
            code = create(tokens["admin"])["code"]
            async with websockets.connect(wsurl(code, tokens["admin"])) as a, websockets.connect(wsurl(code, tokens["player"])) as b:
                await recv_until(b, "room", lambda m: len(m["room"]["players"]) == 2)
                await b.send(json.dumps({"type": "ready", "ready": True}))
                await recv_until(a, "room", lambda m: len(m["room"]["players"]) == 2 and all(p["ready"] for p in m["room"]["players"] if p["user_id"] != m["room"]["host_id"]))
                await a.send(json.dumps({"type": "start"}))
                await recv_until(a, "room", lambda m: m["room"]["status"] == "programming")
                await a.send(json.dumps({"type": "program", "program": ["forward"] * 6, "final": True}))
                res = await recv_until(b, "turn_result", timeout=40)
                f0 = res["frames"][0]
                assert f0["phase"] == "penalty"
                assert any(e.get("t") == "penalty" and e.get("dmg") == 6 for e in f0["events"])
                pl = next(r for r in res["robots"] if r["name"] == "Player")
                assert pl["lives"] == 2 and pl["hp"] == 5
                assert res["frames"][-1]["phase"] == "respawn"
                # no replay_done -> timeout then turn 2
                m = await recv_until(a, "room", lambda m: m["room"]["status"] == "programming" and m["room"]["turn"] == 2, timeout=30)
                assert m["room"]["turn"] == 2
        asyncio.run(run())

    def test_malformed_message_does_not_break_room(self, tokens):
        async def run():
            code = create(tokens["admin"])["code"]
            async with websockets.connect(wsurl(code, tokens["admin"])) as a:
                await recv_until(a, "room")
                async with websockets.connect(wsurl(code, tokens["player"])) as b:
                    await recv_until(a, "room", lambda m: len(m["room"]["players"]) == 2)
                    await a.send(json.dumps({"type": "settings", "board_id": "arena", "max_players": "abc"}))
                    await asyncio.sleep(1)
                    await a.send(json.dumps({"type": "chat", "text": "still alive"}))
                    c = await recv_until(b, "chat", timeout=5)
                    assert c["msg"]["text"] == "still alive"
        asyncio.run(run())

    def test_game_over_and_back_to_lobby(self, tokens):
        async def run():
            code = create(tokens["admin"])["code"]
            async with websockets.connect(wsurl(code, tokens["admin"])) as a, websockets.connect(wsurl(code, tokens["player"])) as b:
                await recv_until(b, "room", lambda m: len(m["room"]["players"]) == 2)
                await b.send(json.dumps({"type": "ready", "ready": True}))
                await recv_until(a, "room", lambda m: len(m["room"]["players"]) == 2 and all(p["ready"] for p in m["room"]["players"] if p["user_id"] != m["room"]["host_id"]))
                await a.send(json.dumps({"type": "start"}))
                res = None
                for turn in range(1, 5):
                    await recv_until(a, "room", lambda m: m["room"]["status"] == "programming" and m["room"]["turn"] == turn, timeout=40)
                    # player first (so admin's socket is the blocked one)
                    await b.send(json.dumps({"type": "program", "program": [], "final": True}))
                    await a.send(json.dumps({"type": "program", "program": ["left", "right"] * 3, "final": True}))
                    res = await recv_until(b, "turn_result", timeout=40)
                    await a.send(json.dumps({"type": "replay_done"})); await b.send(json.dumps({"type": "replay_done"}))
                    if res["game_over"]:
                        break
                assert res["game_over"] and res["winner"] == "R1"
                m = await recv_until(b, "room", lambda m: m["room"]["status"] == "finished", timeout=40)
                assert m["room"]["winner"] == "Admin"
                await b.send(json.dumps({"type": "start"}))  # non-host ignored
                await a.send(json.dumps({"type": "start"}))
                m = await recv_until(b, "room", lambda m: m["room"]["status"] == "lobby", timeout=10)
                assert m["room"]["turn"] == 0 and len(m["room"]["players"]) == 2
                assert all(not p["ready"] and p["robot_id"] is None for p in m["room"]["players"])
        asyncio.run(run())

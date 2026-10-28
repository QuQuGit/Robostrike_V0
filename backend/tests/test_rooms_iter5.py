# Iteration 5: retest of the fixes after iteration 4 (WS robustness, fast turn transition)
import asyncio
import json
import time

import pytest
import websockets

from test_rooms_iter4 import create, login, recv_until, wsurl


@pytest.fixture(scope="module")
def tokens():
    return {"admin": login("admin@robostrike.com", "admin123"), "player": login("player@robostrike.com", "player123")}


# WS robustness: non-JSON / odd JSON must not kill the socket
def test_non_json_and_odd_payloads_keep_socket(tokens):
    async def run():
        code = create(tokens["admin"])["code"]
        async with websockets.connect(wsurl(code, tokens["admin"])) as a:
            await recv_until(a, "room")
            async with websockets.connect(wsurl(code, tokens["player"])) as b:
                await recv_until(a, "room", lambda m: len(m["room"]["players"]) == 2)
                await a.send("this is not json {")
                await a.send(json.dumps({"type": "settings", "max_players": "abc"}))
                await a.send(json.dumps({"type": "settings", "max_players": None}))
                await a.send(json.dumps({"type": "program", "program": 5, "final": True}))
                await asyncio.sleep(1)
                await a.send(json.dumps({"type": "chat", "text": "TEST_alive1"}))
                c = await recv_until(b, "chat", timeout=5)
                assert c["msg"]["text"] == "TEST_alive1"
                # player still connected in room state
                await b.send(json.dumps({"type": "ready", "ready": True}))
                m = await recv_until(a, "room", timeout=5)
                assert all(p["connected"] for p in m["room"]["players"])
                assert len(m["room"]["players"]) == 2
    asyncio.run(run())


# Edge: JSON array / non-object payload
def test_json_array_payload_keeps_socket(tokens):
    async def run():
        code = create(tokens["admin"])["code"]
        async with websockets.connect(wsurl(code, tokens["admin"])) as a:
            await recv_until(a, "room")
            async with websockets.connect(wsurl(code, tokens["player"])) as b:
                await recv_until(a, "room", lambda m: len(m["room"]["players"]) == 2)
                await a.send(json.dumps([1, 2, 3]))
                await asyncio.sleep(1)
                await a.send(json.dumps({"type": "chat", "text": "TEST_alive2"}))
                c = await recv_until(b, "chat", timeout=5)
                assert c["msg"]["text"] == "TEST_alive2"
    asyncio.run(run())


# Fast transition when the host is the last submitter (and vice versa)
def test_fast_transition_both_orders(tokens):
    async def run():
        code = create(tokens["admin"])["code"]
        async with websockets.connect(wsurl(code, tokens["admin"])) as a, websockets.connect(wsurl(code, tokens["player"])) as b:
            await recv_until(b, "room", lambda m: len(m["room"]["players"]) == 2)
            await b.send(json.dumps({"type": "ready", "ready": True}))
            await recv_until(a, "room", lambda m: len(m["room"]["players"]) == 2 and all(p["ready"] for p in m["room"]["players"] if p["user_id"] != m["room"]["host_id"]))
            await a.send(json.dumps({"type": "start"}))
            waits = []
            for turn, order in ((1, (b, a)), (2, (a, b))):
                if turn == 1:
                    await recv_until(a, "room", lambda m: m["room"]["status"] == "programming" and m["room"]["turn"] == turn, timeout=40)
                for w in order:
                    await w.send(json.dumps({"type": "program", "program": ["left", "right"] * 3, "final": True}))
                await recv_until(a, "turn_result", timeout=10)
                await recv_until(b, "turn_result", timeout=10)
                # chat while resolving must be processed immediately from the last submitter
                await order[1].send(json.dumps({"type": "chat", "text": f"TEST_t{turn}"}))
                c = await recv_until(order[0], "chat", timeout=3)
                assert c["msg"]["text"] == f"TEST_t{turn}"
                await a.send(json.dumps({"type": "replay_done"}))
                await b.send(json.dumps({"type": "replay_done"}))
                t0 = time.time()
                await recv_until(a, "room", lambda m: m["room"]["status"] == "programming" and m["room"]["turn"] == turn + 1, timeout=30)
                waits.append(time.time() - t0)
            print("waits", waits)
            assert all(w < 3 for w in waits), waits
    asyncio.run(run())

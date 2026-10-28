import asyncio, json, os, sys, requests, websockets
API = sys.argv[1]
def tok(e, p, u):
    r = requests.post(f"{API}/api/auth/login", json={"email": e, "password": p})
    if r.status_code != 200:
        requests.post(f"{API}/api/auth/register", json={"email": e, "password": p, "username": u})
        r = requests.post(f"{API}/api/auth/login", json={"email": e, "password": p})
    return r.json()["token"]
async def recv_until(ws, typ, pred=lambda m: True, n=60):
    for _ in range(n):
        m = json.loads(await asyncio.wait_for(ws.recv(), 40))
        if m["type"] == typ and pred(m): return m
async def main():
    t1 = tok("admin@robostrike.com", "admin123", "Admin"); t2 = tok("player@robostrike.com", "player123", "Player")
    room = requests.post(f"{API}/api/rooms", json={"board_id": "arena", "max_players": 2}, headers={"Authorization": f"Bearer {t1}"}).json()
    print("room", room)
    print("list", requests.get(f"{API}/api/rooms", headers={"Authorization": f"Bearer {t2}"}).json())
    wsu = API.replace("https", "wss").replace("http", "ws") + f"/api/ws/rooms/{room['code']}?token="
    async with websockets.connect(wsu + t1) as a, websockets.connect(wsu + t2) as b:
        await recv_until(b, "room")
        await b.send(json.dumps({"type": "ready", "ready": True}))
        await recv_until(a, "room", lambda m: all(p["ready"] or p["user_id"] == m["room"]["host_id"] for p in m["room"]["players"]) and len(m["room"]["players"]) == 2)
        await a.send(json.dumps({"type": "chat", "text": "gl hf"}))
        print("chat", (await recv_until(b, "chat"))["msg"]["text"])
        await a.send(json.dumps({"type": "start"}))
        m = await recv_until(b, "room", lambda m: m["room"]["status"] == "programming")
        print("programming turn", m["room"]["turn"], "secs", round(m["room"]["seconds_left"]))
        await a.send(json.dumps({"type": "program", "program": ["forward"] * 6, "final": True}))
        await b.send(json.dumps({"type": "program", "program": ["laser", "laser", None, None, None, None], "final": True}))
        res = await recv_until(a, "turn_result")
        print("frames", len(res["frames"]), "first phase", res["frames"][0]["phase"], res["frames"][0]["events"])
        await a.send(json.dumps({"type": "replay_done"})); await b.send(json.dumps({"type": "replay_done"}))
        m = await recv_until(a, "room", lambda m: m["room"]["status"] == "programming" and m["room"]["turn"] == 2)
        print("turn2 robots hp", [(r["name"], r["hp"], r["lives"]) for r in m["room"]["robots"]])
asyncio.run(main())

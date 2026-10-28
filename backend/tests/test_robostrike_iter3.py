# Iteration 3: boosts, items/pickups, rotators, death/respawn frames
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path("/app/frontend/.env"))
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def rb(rid, x, y, d, program, items=None, hp=5, lives=3, invuln=False, spawn=None):
    prog = list(program) + [None] * (6 - len(program))
    return {"id": rid, "name": rid, "color": "#ef4444", "x": x, "y": y, "dir": d,
            "hp": hp, "max_hp": 5, "lives": lives, "alive": True, "eliminated": False,
            "spawn": spawn or {"x": x, "y": y, "dir": d}, "invuln": invuln,
            "items": items or [], "program": prog}


def idle(rid="R2", x=9, y=0, d=3):
    return rb(rid, x, y, d, [])


def resolve(s, robots, board="arena"):
    r = s.post(f"{BASE_URL}/api/sandbox/resolve", json={"board_id": board, "robots": robots})
    assert r.status_code == 200, r.text
    return r.json()


def final(data, rid):
    return next(r for r in data["robots"] if r["id"] == rid)


def fr(frame, rid):
    return next(r for r in frame["robots"] if r["id"] == rid)


# --- board extras / new sandbox
class TestBoardExtras:
    @pytest.mark.parametrize("bid", ["arena", "foundry", "cross"])
    def test_board_has_rotators_pickups(self, s, bid):
        b = s.get(f"{BASE_URL}/api/boards/{bid}").json()
        assert len(b["rotators"]) == 2 and all(t["rot"] in (1, -1) for t in b["rotators"])
        assert sorted(p["type"] for p in b["pickups"]) == ["bomb", "double_laser", "life", "shield"]

    def test_sandbox_new_items_empty(self, s):
        d = s.post(f"{BASE_URL}/api/sandbox/new", json={"board_id": "arena", "num_robots": 3}).json()
        assert "rotators" in d["board"] and "pickups" in d["board"]
        assert all(r["items"] == [] and r["invuln"] is False for r in d["robots"])


# --- boost chains
class TestBoost:
    def test_turbo_turbo_right_strafes(self, s):
        d = resolve(s, [rb("R1", 5, 1, 0, ["turbo", "turbo", "right"]), idle()])
        f = final(d, "R1")
        assert (f["x"], f["y"], f["dir"]) == (8, 1, 0)

    def test_turbo_forward_two(self, s):
        d = resolve(s, [rb("R1", 0, 7, 0, ["turbo", "forward"]), idle()])
        f = final(d, "R1")
        assert (f["x"], f["y"]) == (0, 5)

    def test_turbo_laser_ignored(self, s):
        d = resolve(s, [rb("R1", 0, 0, 1, ["turbo", "laser"]), idle("R2", 3, 0, 3)])
        assert final(d, "R2")["hp"] == 5
        assert not any(e["t"] == "fire" for f in d["frames"] for e in f["events"])

    def test_turbo_bomb_does_not_consume_item(self, s):
        # Item cannot be played after boost -> it should be ignored and stay in inventory
        d = resolve(s, [rb("R1", 0, 0, 1, ["turbo", "bomb"], items=["bomb"]), idle("R2", 3, 0, 3)])
        assert final(d, "R2")["hp"] == 5
        assert final(d, "R1")["items"] == ["bomb"], "bomb was consumed although it was ignored"


# --- items
class TestItems:
    def test_items_without_inventory_ignored(self, s):
        d = resolve(s, [rb("R1", 0, 0, 1, ["bomb", "double_laser", "shield"]), idle("R2", 2, 0, 3)])
        assert final(d, "R2")["hp"] == 5

    def test_bomb_with_item(self, s):
        d = resolve(s, [rb("R1", 0, 0, 1, ["bomb"], items=["bomb"]), idle("R2", 3, 0, 3)])
        assert final(d, "R2")["hp"] == 2
        assert final(d, "R1")["items"] == []

    def test_bomb_range_limit(self, s):
        d = resolve(s, [rb("R1", 0, 0, 1, ["bomb"], items=["bomb"]), idle("R2", 4, 0, 3)])
        assert final(d, "R2")["hp"] == 5

    def test_double_laser_item(self, s):
        d = resolve(s, [rb("R1", 0, 0, 1, ["double_laser"], items=["double_laser"]), idle("R2", 8, 0, 3)])
        assert final(d, "R2")["hp"] == 3 and final(d, "R1")["items"] == []


# --- pickups
class TestPickups:
    def test_pickup_bomb(self, s):
        d = resolve(s, [rb("R1", 2, 6, 0, ["forward"]), idle()])
        mv = next(f for f in d["frames"] if f["slot"] == 0 and f["phase"] == "move")
        assert "p1" in mv["taken"]
        assert fr(mv, "R1")["items"] == ["bomb"]
        assert final(d, "R1")["items"] == ["bomb"]

    def test_pickup_life(self, s):
        d = resolve(s, [rb("R1", 6, 3, 3, ["forward"], hp=2), idle()])
        mv = next(f for f in d["frames"] if f["slot"] == 0 and f["phase"] == "move")
        assert fr(mv, "R1")["hp"] == 5 and "p4" in mv["taken"]
        assert final(d, "R1")["items"] == []

    def test_pickup_taken_once_per_turn(self, s):
        # R1 takes shield (4,4) at slot0, leaves, R2 steps on it later -> nothing
        r1 = rb("R1", 4, 5, 0, ["forward", "right", "forward"])  # (4,4) -> turn E -> (5,4)? wall at (5,4,W)
        r1 = rb("R1", 3, 4, 1, ["forward", "backward"])            # (4,4) then back to (3,4)
        r2 = rb("R2", 4, 6, 0, [None, None, "forward", "forward"])  # (4,5) then (4,4)
        d = resolve(s, [r1, r2])
        assert final(d, "R1")["items"] == ["shield"]
        assert final(d, "R2")["items"] == []
        # next turn pickup is available again
        d2 = resolve(s, [rb("R1", 0, 0, 1, []), rb("R2", 4, 5, 0, ["forward"])])
        m0 = next(f for f in d2["frames"] if f["slot"] == 0 and f["phase"] == "move")
        assert "shield" in fr(m0, "R2")["items"]


# --- rotators
class TestRotators:
    def test_rotator_plus(self, s):
        d = resolve(s, [rb("R1", 3, 1, 0, []), idle()])
        b0 = next(f for f in d["frames"] if f["slot"] == 0 and f["phase"] == "board")
        assert fr(b0, "R1")["dir"] == 1

    def test_rotator_minus(self, s):
        d = resolve(s, [rb("R1", 6, 6, 0, []), idle()])
        b0 = next(f for f in d["frames"] if f["slot"] == 0 and f["phase"] == "board")
        assert fr(b0, "R1")["dir"] == 3


# --- deaths & respawn
class TestDeath:
    def test_fall_dead_no_act_respawn(self, s):
        sp = {"x": 0, "y": 7, "dir": 1}
        r1 = rb("R1", 2, 2, 2, ["forward", "laser", "laser", "laser"], spawn=sp)
        d = resolve(s, [r1, idle("R2", 9, 3, 3)])
        later = [f for f in d["frames"] if f["slot"] >= 1 and f["phase"] != "respawn"]
        assert all(fr(f, "R1")["dead"] and not fr(f, "R1")["alive"] for f in later)
        assert not any(e["t"] == "fire" for f in d["frames"] for e in f["events"])
        last = d["frames"][-1]
        assert last["phase"] == "respawn"
        r = fr(last, "R1")
        assert (r["x"], r["y"], r["hp"], r["invuln"], r["lives"], r["alive"]) == (0, 7, 5, True, 2, True)
        assert final(d, "R1")["invuln"] is True

    def test_destroyed_by_laser_stops_acting(self, s):
        r1 = rb("R1", 3, 0, 3, ["forward", "forward"], hp=1, spawn={"x": 9, "y": 7, "dir": 3})
        r2 = rb("R2", 0, 0, 1, ["laser"])
        d = resolve(s, [r1, r2])
        shots0 = next(f for f in d["frames"] if f["slot"] == 0 and f["phase"] == "shots")
        x = fr(shots0, "R1")
        assert x["dead"] and not x["alive"] and (x["x"], x["y"]) == (3, 0)
        mv = next(f for f in d["frames"] if f["slot"] == 1 and f["phase"] == "move")
        assert (fr(mv, "R1")["x"], fr(mv, "R1")["y"]) == (3, 0)
        assert d["frames"][-1]["phase"] == "respawn"

    def test_invuln_blocks_damage_next_turn(self, s):
        d = resolve(s, [rb("R1", 3, 0, 3, [], invuln=True), rb("R2", 0, 0, 1, ["laser"])])
        assert final(d, "R1")["hp"] == 5 and final(d, "R1")["invuln"] is False

    def test_elimination_after_three_turns(self, s):
        sp = {"x": 2, "y": 2, "dir": 2}
        r1 = rb("R1", 2, 2, 2, ["forward"], spawn=sp)
        r2 = idle("R2", 9, 3, 3)
        for turn in range(3):
            d = resolve(s, [r1, r2])
            r1 = final(d, "R1"); r1["program"] = ["forward"] + [None] * 5
            r2 = final(d, "R2"); r2["program"] = [None] * 6
            if turn < 2:
                assert r1["lives"] == 2 - turn and not r1["eliminated"] and not d["game_over"]
        assert r1["eliminated"] and d["game_over"] and d["winner"] == "R2"

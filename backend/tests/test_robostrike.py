"""Backend tests for Robostrike V1: auth, boards, sandbox, engine."""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path("/app/frontend/.env"))
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login",
                     json={"email": "admin@robostrike.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def new_user(session):
    email = f"test_{uuid.uuid4().hex[:8]}@robostrike.com"
    r = session.post(f"{API}/auth/register",
                     json={"email": email, "password": "pwd12345", "username": "Tester"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    return {"email": email, "password": "pwd12345", "token": data["token"], "user": data["user"]}


# ---------- auth ----------
class TestAuth:
    def test_register_returns_token_and_user(self, new_user):
        assert new_user["user"]["xp"] == 0
        assert new_user["user"]["level"] == 1
        assert "stats" in new_user["user"]

    def test_login_user(self, session, new_user):
        r = session.post(f"{API}/auth/login",
                         json={"email": new_user["email"], "password": new_user["password"]})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == new_user["email"]

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login",
                         json={"email": "nobody@x.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_auth(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, session, new_user):
        r = session.get(f"{API}/auth/me",
                        headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == new_user["email"]
        assert "xp" in body and "level" in body and "stats" in body

    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10


# ---------- boards ----------
class TestBoards:
    def test_list(self, session):
        r = session.get(f"{API}/boards")
        assert r.status_code == 200
        ids = {b["id"] for b in r.json()}
        assert {"foundry", "cross", "arena"}.issubset(ids)

    def test_get_board_full(self, session):
        r = session.get(f"{API}/boards/foundry")
        assert r.status_code == 200
        b = r.json()
        for k in ("walls", "conveyors", "holes", "lasers", "spawns", "width", "height"):
            assert k in b

    def test_get_board_404(self, session):
        r = session.get(f"{API}/boards/does_not_exist")
        assert r.status_code == 404


# ---------- sandbox new ----------
class TestSandboxNew:
    def test_spawn_two(self, session):
        r = session.post(f"{API}/sandbox/new", json={"board_id": "cross", "num_robots": 2})
        assert r.status_code == 200
        data = r.json()
        assert len(data["robots"]) == 2
        for rob in data["robots"]:
            assert rob["hp"] == 5 and rob["max_hp"] == 5 and rob["lives"] == 3
            assert rob["program"] == [None] * 6

    def test_spawn_clamped(self, session):
        r = session.post(f"{API}/sandbox/new", json={"board_id": "cross", "num_robots": 99})
        assert r.status_code == 200
        robots = r.json()["robots"]
        assert 2 <= len(robots) <= 6


# ---------- engine ----------
def _robot(rid, x, y, d, program, hp=5, items=None):
    return {
        "items": items or [],
        "id": rid, "name": rid, "color": "#ef4444",
        "x": x, "y": y, "dir": d, "hp": hp, "max_hp": 5, "lives": 3,
        "alive": True, "eliminated": False,
        "spawn": {"x": x, "y": y, "dir": d},
        "program": program + [None] * (6 - len(program)),
    }


def _resolve(session, board_id, robots):
    r = session.post(f"{API}/sandbox/resolve",
                     json={"board_id": board_id, "robots": robots})
    assert r.status_code == 200, r.text
    return r.json()


class TestEngineMovement:
    def test_forward(self, session):
        # arena: use empty area to avoid walls/holes/conveyors
        robots = [_robot("A", 5, 1, 1, ["forward"])]  # facing east
        res = _resolve(session, "arena", robots)
        final = res["robots"][0]
        assert (final["x"], final["y"]) == (6, 1)

    def test_turn_left_right_uturn(self, session):
        # Use (6,1) to avoid board laser columns (x=4 and x=5) on arena
        robots = [_robot("A", 6, 1, 0, ["left", "right", "right", "right", None, None])]
        res = _resolve(session, "arena", robots)
        # 0 -> left=3 -> right=0 -> right=1 -> right=2
        assert res["robots"][0]["dir"] == 2

    def test_turbo_moves_two(self, session):
        robots = [_robot("A", 5, 1, 1, ["turbo", "forward"])]
        res = _resolve(session, "arena", robots)
        final = res["robots"][0]
        assert (final["x"], final["y"]) == (7, 1)

    def test_boost_stacks_and_strafes(self, session):
        # 2 boosts + right = move 3 cells to the right of facing (north -> east), no rotation
        robots = [_robot("A", 5, 1, 0, ["turbo", "turbo", "right"])]
        res = _resolve(session, "arena", robots)
        final = res["robots"][0]
        assert (final["x"], final["y"], final["dir"]) == (8, 1, 0)

    def test_weapon_after_boost_is_noop(self, session):
        robots = [_robot("A", 1, 1, 1, ["turbo", "laser"]), _robot("B", 3, 1, 1, [])]
        res = _resolve(session, "arena", robots)
        assert next(r for r in res["robots"] if r["id"] == "B")["hp"] == 5

    def test_turbo_blocked_by_edge(self, session):
        # arena width=10. Place at x=8 facing east -> can only move to 9, blocked after
        robots = [_robot("A", 8, 1, 1, ["turbo", "forward"])]
        res = _resolve(session, "arena", robots)
        final = res["robots"][0]
        assert (final["x"], final["y"]) == (9, 1)

    def test_frames_shape(self, session):
        robots = [_robot("A", 5, 1, 1, ["forward"] * 6)]
        res = _resolve(session, "arena", robots)
        assert len(res["frames"]) == 24
        phases = [f["phase"] for f in res["frames"][:4]]
        assert phases == ["shots", "move", "board", "resolve"]


class TestEnginePush:
    def test_push_robot(self, session):
        # A at (5,1) facing east pushes B at (6,1) to (7,1)
        robots = [
            _robot("A", 5, 1, 1, ["forward"]),
            _robot("B", 6, 1, 1, []),
        ]
        res = _resolve(session, "arena", robots)
        a, b = res["robots"]
        assert (a["x"], a["y"]) == (6, 1)
        assert (b["x"], b["y"]) == (7, 1)


class TestEngineWeapons:
    def test_laser_damage(self, session):
        # row y=1, columns x=1 and x=3 to avoid arena board laser at x=4 (dir south)
        robots = [
            _robot("A", 1, 1, 1, ["laser"]),
            _robot("B", 3, 1, 1, []),
        ]
        res = _resolve(session, "arena", robots)
        b_final = next(r for r in res["robots"] if r["id"] == "B")
        assert b_final["hp"] == 4

    def test_double_laser_damage(self, session):
        robots = [
            _robot("A", 1, 1, 1, ["double_laser"], items=["double_laser"]),
            _robot("B", 3, 1, 1, []),
        ]
        res = _resolve(session, "arena", robots)
        b_final = next(r for r in res["robots"] if r["id"] == "B")
        assert b_final["hp"] == 3

    def test_blast_hits_adjacent(self, session):
        # A at (5,2) blast -> hits adjacent N,E,S,W
        robots = [
            _robot("A", 7, 1, 1, ["blast"]),
            _robot("B", 8, 1, 1, []),  # east adj
            _robot("C", 7, 0, 1, []),  # north adj
        ]
        res = _resolve(session, "arena", robots)
        b = next(r for r in res["robots"] if r["id"] == "B")
        c = next(r for r in res["robots"] if r["id"] == "C")
        assert b["hp"] == 4
        assert c["hp"] == 4

    def test_bomb_damage(self, session):
        robots = [
            _robot("A", 1, 1, 1, ["bomb"], items=["bomb"]),
            _robot("B", 3, 1, 1, []),
        ]
        res = _resolve(session, "arena", robots)
        b = next(r for r in res["robots"] if r["id"] == "B")
        assert b["hp"] == 2

    def test_shield_blocks(self, session):
        # Both play simultaneously - weapons use start-of-slot shields
        robots = [
            _robot("A", 1, 1, 1, ["laser"]),
            _robot("B", 3, 1, 1, ["shield"], items=["shield"]),
        ]
        res = _resolve(session, "arena", robots)
        b = next(r for r in res["robots"] if r["id"] == "B")
        assert b["hp"] == 5  # unchanged


class TestEngineHolesRespawn:
    def test_fall_respawn(self, session):
        # arena hole at (2,3). Robot at (1,3) facing east, forward -> falls
        robots = [_robot("A", 1, 3, 1, ["forward"])]
        res = _resolve(session, "arena", robots)
        a = res["robots"][0]
        # Should have respawned (lives decreased, hp restored, invuln True)
        assert a["lives"] == 2
        assert a["hp"] == a["max_hp"]
        assert (a["x"], a["y"]) == (a.get("spawn", {}).get("x", 1), a.get("spawn", {}).get("y", 3))

    def test_elimination_after_three_deaths(self, session):
        # 6 slots: forward into hole each slot? Needs re-entering hole. Use bomb to kill via hp.
        # Simpler: give robot 1 hp and shoot it from close range repeatedly? Only self can't.
        # Instead: fall into hole thrice. Place at (1,3), do forward (fall), respawn at spawn=(1,3) facing east again, forward again, ...
        robots = [_robot("A", 1, 3, 1, ["forward"] * 6)]
        for _ in range(3):
            res = _resolve(session, "arena", robots)
            a = res["robots"][0]
            robots = [{**a, "program": ["forward"] * 6}]
        assert a["eliminated"] is True
        assert a["lives"] <= 0
        assert res.get("game_over") is False  # only one robot total, so not game over


class TestPickupsAndDeath:
    def test_item_card_requires_inventory(self, session):
        robots = [_robot("A", 1, 1, 1, ["bomb"]), _robot("B", 3, 1, 1, [])]
        res = _resolve(session, "arena", robots)
        assert next(r for r in res["robots"] if r["id"] == "B")["hp"] == 5

    def test_pickup_bomb_and_life(self, session):
        # arena: bomb pickup at (2,5), life at (5,3)
        robots = [_robot("A", 1, 5, 1, ["forward"]), _robot("B", 6, 3, 3, ["forward"], hp=2)]
        res = _resolve(session, "arena", robots)
        a, b = res["robots"]
        assert a["items"] == ["bomb"]
        assert b["hp"] == 5
        assert "p1" in res["frames"][-1]["taken"]

    def test_dead_robot_waits_until_end_of_turn(self, session):
        robots = [_robot("A", 1, 3, 1, ["forward", "forward", "forward"])]
        res = _resolve(session, "arena", robots)
        mid = res["frames"][5]["robots"][0]
        assert mid["dead"] is True and mid["alive"] is False
        assert res["frames"][-1]["phase"] == "respawn"
        a = res["robots"][0]
        assert a["lives"] == 2 and a["alive"] and a["invuln"]


def test_death_loses_items(session):
    robots = [_robot("A", 1, 3, 1, ["forward"], items=["bomb", "shield"])]
    res = _resolve(session, "arena", robots)
    assert res["robots"][0]["items"] == []

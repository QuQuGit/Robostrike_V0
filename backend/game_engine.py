"""Robostrike server-authoritative game engine.

Pure-python, deterministic. Resolves a turn slot by slot (6 slots), producing
a list of animation *frames* (full robot snapshots + visual beams + events)
so the client can replay / step through the resolution.
Directions: 0=N, 1=E, 2=S, 3=W. y grows downward.
"""
from copy import deepcopy

SLOTS = 6

DX = {0: 0, 1: 1, 2: 0, 3: -1}
DY = {0: -1, 1: 0, 2: 1, 3: 0}

# weapon_id -> (damage, range)   range None == full board line
WEAPONS = {
    "laser": (1, None),
    "double_laser": (2, None),
    "blast": (1, 1),       # all 4 adjacent cells
    "bomb": (3, 3),        # line, max range 3
}
DEFAULT_ACTIONS = {"forward", "backward", "left", "right", "laser", "blast", "turbo"}
ITEM_ACTIONS = {"bomb", "double_laser", "shield"}
ACTION_IDS = DEFAULT_ACTIONS | ITEM_ACTIONS
MOVES = {"forward", "backward", "left", "right"}


def _opp(d):
    return (d + 2) % 4


def _wallset(board):
    return {(w[0], w[1], w[2]) for w in board.get("walls", [])}


def _has_wall(ws, x, y, d):
    if (x, y, d) in ws:
        return True
    nx, ny = x + DX[d], y + DY[d]
    return (nx, ny, _opp(d)) in ws


def _in_bounds(board, x, y):
    return 0 <= x < board["width"] and 0 <= y < board["height"]


def _active(r):
    return r["alive"] and not r.get("eliminated")


def _robot_at(robots, x, y, exclude=None):
    for r in robots:
        if r is not exclude and _active(r) and r["x"] == x and r["y"] == y:
            return r
    return None


def _holes(board):
    return {(h[0], h[1]) for h in board.get("holes", [])}


def _conveyors(board):
    return {(c["x"], c["y"]): c["dir"] for c in board.get("conveyors", [])}


# ----------------------------------------------------------------------------
# program compilation (boost chains)
# ----------------------------------------------------------------------------
def compile_program(program, items):
    """Validate a 6-slot program and expand boosts.

    Each boost (turbo) slot does nothing itself and adds +1 cell to the next
    movement. Rotations after a boost become a lateral move without rotation.
    Weapons / items cannot follow a boost. Item cards need inventory.
    Returns (list of (action, steps), consumed_items).
    """
    prog = list(program or [])[:SLOTS]
    prog += [None] * (SLOTS - len(prog))
    stock = list(items or [])
    out, used, boost = [], [], 0
    for a in prog:
        if a not in ACTION_IDS:
            a = None
        if a == "turbo":
            boost += 1
            out.append(("turbo", 0))
            continue
        if boost and a is not None and a not in MOVES:
            a = None
        if a in ITEM_ACTIONS:
            if a in stock:
                stock.remove(a)
                used.append(a)
            else:
                a = None
        out.append((a, 1 + boost if a in MOVES else 0))
        boost = 0
    return out, used


# ----------------------------------------------------------------------------
# movement
# ----------------------------------------------------------------------------
def _try_move(board, ws, robots, robot, d, events):
    """Move robot one cell in dir d, pushing chains. Returns True if moved."""
    if _has_wall(ws, robot["x"], robot["y"], d):
        return False
    nx, ny = robot["x"] + DX[d], robot["y"] + DY[d]
    if not _in_bounds(board, nx, ny):
        return False
    occ = _robot_at(robots, nx, ny, exclude=robot)
    if occ is not None:
        if not _try_move(board, ws, robots, occ, d, events):
            return False
        events.append({"t": "push", "robot": robot["name"], "target": occ["name"]})
    robot["x"], robot["y"] = nx, ny
    return True


def _move_steps(board, ws, robots, robot, d, steps, events):
    holes = _holes(board)
    total = 0
    for _ in range(steps):
        if not _try_move(board, ws, robots, robot, d, events):
            break
        total += 1
        if (robot["x"], robot["y"]) in holes:
            break
    events.append({"t": "move" if total else "blocked", "robot": robot["name"], "n": total})


def _exec_action(board, ws, robots, robot, action, steps, events):
    boosted = steps > 1
    if action in ("left", "right") and not boosted:
        robot["dir"] = (robot["dir"] + (-1 if action == "left" else 1)) % 4
        events.append({"t": "turn", "robot": robot["name"]})
    elif action in ("left", "right"):
        d = (robot["dir"] + (-1 if action == "left" else 1)) % 4
        _move_steps(board, ws, robots, robot, d, steps, events)
    elif action == "forward":
        _move_steps(board, ws, robots, robot, robot["dir"], steps, events)
    elif action == "backward":
        _move_steps(board, ws, robots, robot, _opp(robot["dir"]), steps, events)


# ----------------------------------------------------------------------------
# weapons
# ----------------------------------------------------------------------------
def _fire_line(board, ws, robots, shooter, dmg, rng, beams, btype):
    x, y, d = shooter["x"], shooter["y"], shooter["dir"]
    steps = rng if rng is not None else (board["width"] + board["height"])
    cx, cy = x, y
    for _ in range(steps):
        if _has_wall(ws, cx, cy, d):
            break
        nx, ny = cx + DX[d], cy + DY[d]
        if not _in_bounds(board, nx, ny):
            break
        cx, cy = nx, ny
        hit = _robot_at(robots, cx, cy, exclude=shooter)
        if hit is not None:
            beams.append({"type": btype, "from": [x, y], "to": [cx, cy],
                          "color": shooter["color"], "hit": True, "by": shooter["id"]})
            return [(hit, dmg)]
    beams.append({"type": btype, "from": [x, y], "to": [cx, cy],
                  "color": shooter["color"], "hit": False, "by": shooter["id"]})
    return []


def _fire_blast(board, robots, shooter, dmg, beams):
    out = []
    beams.append({"type": "blast", "from": [shooter["x"], shooter["y"]],
                  "to": [shooter["x"], shooter["y"]], "color": shooter["color"], "by": shooter["id"]})
    for d in range(4):
        tx, ty = shooter["x"] + DX[d], shooter["y"] + DY[d]
        if not _in_bounds(board, tx, ty):
            continue
        hit = _robot_at(robots, tx, ty, exclude=shooter)
        if hit is not None:
            out.append((hit, dmg))
    return out


def _apply_damage(dmg_map, events):
    for _, (r, dmg) in dmg_map.items():
        if r.get("shield"):
            events.append({"t": "shielded", "robot": r["name"], "dmg": dmg})
            continue
        if r.get("invuln"):
            events.append({"t": "immune", "robot": r["name"], "dmg": dmg})
            continue
        r["hp"] = max(0, r["hp"] - dmg)
        events.append({"t": "hit", "robot": r["name"], "dmg": dmg})


# ----------------------------------------------------------------------------
# board effects, pickups & deaths
# ----------------------------------------------------------------------------
def _board_effects(board, ws, robots, events, beams):
    conv = _conveyors(board)
    for r in robots:
        if not _active(r):
            continue
        d = conv.get((r["x"], r["y"]))
        if d is None or _has_wall(ws, r["x"], r["y"], d):
            continue
        nx, ny = r["x"] + DX[d], r["y"] + DY[d]
        if _in_bounds(board, nx, ny) and _robot_at(robots, nx, ny, exclude=r) is None:
            r["x"], r["y"] = nx, ny
            events.append({"t": "conveyor", "robot": r["name"]})
    # turntables
    rot = {(t["x"], t["y"]): t["rot"] for t in board.get("rotators", [])}
    for r in robots:
        if _active(r) and (r["x"], r["y"]) in rot:
            r["dir"] = (r["dir"] + rot[(r["x"], r["y"])]) % 4
            events.append({"t": "rotator", "robot": r["name"]})
    # board lasers
    dmg_map = {}
    for lz in board.get("lasers", []):
        x, y, d = lz["x"], lz["y"], lz["dir"]
        dmg = lz.get("damage", 1)
        cx, cy = x, y
        hit = _robot_at(robots, cx, cy)
        while hit is None:
            if _has_wall(ws, cx, cy, d):
                break
            nx, ny = cx + DX[d], cy + DY[d]
            if not _in_bounds(board, nx, ny):
                break
            cx, cy = nx, ny
            hit = _robot_at(robots, cx, cy)
        beams.append({"type": "board_laser", "from": [x, y], "to": [cx, cy], "hit": hit is not None})
        if hit is not None:
            prev = dmg_map.get(id(hit), (hit, 0))[1]
            dmg_map[id(hit)] = (hit, prev + dmg)
    for _, (r, dmg) in dmg_map.items():
        if r.get("shield") or r.get("invuln"):
            continue
        r["hp"] = max(0, r["hp"] - dmg)
        events.append({"t": "board_laser_hit", "robot": r["name"], "dmg": dmg})


def _collect_pickups(board, robots, taken, events):
    for p in board.get("pickups", []):
        if p["id"] in taken:
            continue
        r = _robot_at(robots, p["x"], p["y"])
        if r is None:
            continue
        taken.add(p["id"])
        if p["type"] == "life":
            r["hp"] = r["max_hp"]
        else:
            r["items"].append(p["type"])
        events.append({"t": "pickup", "robot": r["name"], "item": p["type"]})


def _resolve_deaths(board, robots, events, beams):
    holes = _holes(board)
    for r in robots:
        if not _active(r):
            continue
        if (r["x"], r["y"]) in holes:
            events.append({"t": "fell", "robot": r["name"]})
        elif r["hp"] <= 0:
            events.append({"t": "destroyed", "robot": r["name"]})
            beams.append({"type": "explode", "from": [r["x"], r["y"]], "to": [r["x"], r["y"]]})
        else:
            continue
        r["lives"] -= 1
        r["alive"] = False
        r["hp"] = 0
        if r["lives"] <= 0:
            r["eliminated"] = True
            events.append({"t": "eliminated", "robot": r["name"]})
        else:
            r["dead"] = True


def _respawn_dead(board, robots, events):
    for r in robots:
        if not r.get("dead"):
            continue
        spots = [r["spawn"]] + [s for s in board.get("spawns", []) if s != r["spawn"]]
        sp = next((s for s in spots if _robot_at(robots, s["x"], s["y"]) is None), r["spawn"])
        r["x"], r["y"], r["dir"] = sp["x"], sp["y"], sp["dir"]
        r["hp"] = r["max_hp"]
        r["alive"], r["dead"], r["invuln"] = True, False, True
        events.append({"t": "respawn", "robot": r["name"], "lives": r["lives"]})


# ----------------------------------------------------------------------------
# frames
# ----------------------------------------------------------------------------
def _snapshot(robots):
    return [{
        "id": r["id"], "name": r["name"], "color": r["color"],
        "x": r["x"], "y": r["y"], "dir": r["dir"],
        "hp": r["hp"], "max_hp": r["max_hp"], "lives": r["lives"],
        "alive": r["alive"], "eliminated": r.get("eliminated", False),
        "dead": r.get("dead", False), "items": list(r["items"]),
        "shield": r.get("shield", False), "invuln": r.get("invuln", False),
    } for r in robots]


def resolve_turn(board, robots_in):
    """robots_in: list of dicts with program[6] and items. Returns frames + final state."""
    ws = _wallset(board)
    robots = deepcopy(robots_in)
    for r in robots:
        r["shield"] = False
        r["dead"] = False
        r["invuln"] = bool(r.get("invuln"))
        r["items"] = list(r.get("items") or [])
        compiled, used = compile_program(r.get("program"), r["items"])
        for it in used:
            r["items"].remove(it)
        r["compiled"] = compiled

    taken = set()
    frames = []

    def frame(slot, phase, events, beams):
        frames.append({"slot": slot, "phase": phase, "robots": _snapshot(robots),
                       "events": events, "beams": beams, "taken": sorted(taken)})

    for slot in range(SLOTS):
        for r in robots:
            r["shield"] = _active(r) and r["compiled"][slot][0] == "shield"

        beams, events, dmg_map = [], [], {}
        for r in robots:
            if not _active(r):
                continue
            act = r["compiled"][slot][0]
            if act not in WEAPONS:
                continue
            events.append({"t": "fire", "robot": r["name"], "weapon": act})
            dmg, rng = WEAPONS[act]
            if act == "blast":
                hits = _fire_blast(board, robots, r, dmg, beams)
            else:
                hits = _fire_line(board, ws, robots, r, dmg, rng, beams, act)
            for hit, dv in hits:
                prev = dmg_map.get(id(hit), (hit, 0))[1]
                dmg_map[id(hit)] = (hit, prev + dv)
        _apply_damage(dmg_map, events)
        _resolve_deaths(board, robots, events, beams)
        frame(slot, "shots", events, beams)

        events = []
        for r in robots:
            if not _active(r):
                continue
            act, steps = r["compiled"][slot]
            if act in MOVES:
                _exec_action(board, ws, robots, r, act, steps, events)
            elif act == "turbo":
                events.append({"t": "boost", "robot": r["name"]})
        _collect_pickups(board, robots, taken, events)
        frame(slot, "move", events, [])

        events, beams = [], []
        _board_effects(board, ws, robots, events, beams)
        _collect_pickups(board, robots, taken, events)
        frame(slot, "board", events, beams)

        events, beams = [], []
        _resolve_deaths(board, robots, events, beams)
        frame(slot, "resolve", events, beams)

        for r in robots:
            r["shield"] = False

    # end of turn: invulnerability only lasts one turn, then destroyed robots return
    for r in robots:
        r["invuln"] = False
    events = []
    _respawn_dead(board, robots, events)
    if events:
        frame(SLOTS - 1, "respawn", events, [])

    survivors = [r for r in robots if not r.get("eliminated")]
    game_over = len(robots) > 1 and len(survivors) <= 1
    winner = survivors[0]["id"] if (game_over and survivors) else None

    final = _snapshot(robots)
    for f, r in zip(final, robots):
        f["spawn"] = r["spawn"]
        f["program"] = [None] * SLOTS
    return {"frames": frames, "robots": final, "game_over": game_over, "winner": winner}

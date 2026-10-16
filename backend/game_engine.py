"""Robostrike server-authoritative game engine.

Pure-python, deterministic. Resolves a turn slot by slot (6 slots), producing
a list of animation *frames* (full robot snapshots + visual beams + events)
so the client can replay / step through the resolution.
Directions: 0=N, 1=E, 2=S, 3=W. y grows downward.
"""
from copy import deepcopy

SLOTS = 6
TURBO_STEPS = 2

DX = {0: 0, 1: 1, 2: 0, 3: -1}
DY = {0: -1, 1: 0, 2: 1, 3: 0}

# weapon_id -> (damage, range)   range None == full board line
WEAPONS = {
    "laser": (1, None),
    "double_laser": (2, None),
    "blast": (1, 1),       # all 4 adjacent cells
    "bomb": (3, 3),        # line, max range 3
}
ACTION_IDS = {
    "forward", "backward", "left", "right", "uturn", "turbo", "shield",
    "laser", "double_laser", "blast", "bomb",
}


def _opp(d):
    return (d + 2) % 4


def _wallset(board):
    s = set()
    for w in board.get("walls", []):
        s.add((w[0], w[1], w[2]))
    return s


def _has_wall(ws, x, y, d):
    if (x, y, d) in ws:
        return True
    nx, ny = x + DX[d], y + DY[d]
    return (nx, ny, _opp(d)) in ws


def _in_bounds(board, x, y):
    return 0 <= x < board["width"] and 0 <= y < board["height"]


def _robot_at(robots, x, y, exclude=None):
    for r in robots:
        if r is exclude:
            continue
        if r["alive"] and not r.get("eliminated") and r["x"] == x and r["y"] == y:
            return r
    return None


def _holes(board):
    return {(h[0], h[1]) for h in board.get("holes", [])}


def _conveyors(board):
    return {(c["x"], c["y"]): c["dir"] for c in board.get("conveyors", [])}


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


def _exec_action(board, ws, robots, robot, action, events):
    if action == "left":
        robot["dir"] = (robot["dir"] - 1) % 4
        events.append({"t": "turn", "robot": robot["name"]})
    elif action == "right":
        robot["dir"] = (robot["dir"] + 1) % 4
        events.append({"t": "turn", "robot": robot["name"]})
    elif action == "uturn":
        robot["dir"] = (robot["dir"] + 2) % 4
        events.append({"t": "turn", "robot": robot["name"]})
    elif action == "forward":
        moved = _try_move(board, ws, robots, robot, robot["dir"], events)
        events.append({"t": "move" if moved else "blocked", "robot": robot["name"]})
    elif action == "backward":
        moved = _try_move(board, ws, robots, robot, _opp(robot["dir"]), events)
        events.append({"t": "move" if moved else "blocked", "robot": robot["name"]})
    elif action == "turbo":
        total = 0
        for _ in range(TURBO_STEPS):
            if _try_move(board, ws, robots, robot, robot["dir"], events):
                total += 1
            else:
                break
        events.append({"t": "move" if total else "blocked", "robot": robot["name"]})


# ----------------------------------------------------------------------------
# weapons
# ----------------------------------------------------------------------------
def _cell_center(x, y):
    return [x, y]


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
            beams.append({"type": btype, "from": _cell_center(x, y),
                          "to": _cell_center(cx, cy), "color": shooter["color"], "hit": True})
            return [(hit, dmg)]
    beams.append({"type": btype, "from": _cell_center(x, y),
                  "to": _cell_center(cx, cy), "color": shooter["color"], "hit": False})
    return []


def _fire_blast(board, robots, shooter, dmg, beams):
    out = []
    beams.append({"type": "blast", "from": _cell_center(shooter["x"], shooter["y"]),
                  "to": _cell_center(shooter["x"], shooter["y"]), "color": shooter["color"]})
    for d in range(4):
        tx, ty = shooter["x"] + DX[d], shooter["y"] + DY[d]
        if not _in_bounds(board, tx, ty):
            continue
        hit = _robot_at(robots, tx, ty, exclude=shooter)
        if hit is not None:
            out.append((hit, dmg))
    return out


def _apply_damage(dmg_map, events):
    # dmg_map is {id(robot): (robot, dmg)}
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
# board effects & deaths
# ----------------------------------------------------------------------------
def _board_effects(board, ws, robots, events, beams):
    conv = _conveyors(board)
    # conveyors: compute intended targets, apply sequentially (no push)
    for r in robots:
        if not r["alive"] or r.get("eliminated"):
            continue
        d = conv.get((r["x"], r["y"]))
        if d is None:
            continue
        if _has_wall(ws, r["x"], r["y"], d):
            continue
        nx, ny = r["x"] + DX[d], r["y"] + DY[d]
        if not _in_bounds(board, nx, ny):
            continue
        if _robot_at(robots, nx, ny, exclude=r) is None:
            r["x"], r["y"] = nx, ny
            events.append({"t": "conveyor", "robot": r["name"]})
    # board lasers
    dmg_map = {}
    for lz in board.get("lasers", []):
        x, y, d = lz["x"], lz["y"], lz["dir"]
        dmg = lz.get("damage", 1)
        cx, cy = x, y
        steps = board["width"] + board["height"]
        for _ in range(steps):
            if _has_wall(ws, cx, cy, d):
                break
            nx, ny = cx + DX[d], cy + DY[d]
            if not _in_bounds(board, nx, ny):
                break
            cx, cy = nx, ny
            hit = _robot_at(robots, cx, cy)
            if hit is not None:
                key = id(hit)
                prev = dmg_map.get(key, (hit, 0))[1]
                dmg_map[key] = (hit, prev + dmg)
                beams.append({"type": "board_laser", "from": [x, y], "to": [cx, cy]})
                break
        else:
            beams.append({"type": "board_laser", "from": [x, y], "to": [cx, cy]})
    for _, (r, dmg) in dmg_map.items():
        if r.get("shield") or r.get("invuln"):
            continue
        r["hp"] = max(0, r["hp"] - dmg)
        events.append({"t": "board_laser_hit", "robot": r["name"], "dmg": dmg})


def _resolve_deaths(board, robots, events):
    holes = _holes(board)
    for r in robots:
        if not r["alive"] or r.get("eliminated"):
            continue
        died = False
        if (r["x"], r["y"]) in holes:
            died = True
            events.append({"t": "fell", "robot": r["name"]})
        elif r["hp"] <= 0:
            died = True
            events.append({"t": "destroyed", "robot": r["name"]})
        if not died:
            continue
        r["lives"] -= 1
        if r["lives"] <= 0:
            r["alive"] = False
            r["eliminated"] = True
            r["hp"] = 0
            events.append({"t": "eliminated", "robot": r["name"]})
        else:
            sp = r["spawn"]
            r["x"], r["y"], r["dir"] = sp["x"], sp["y"], sp["dir"]
            r["hp"] = r["max_hp"]
            r["invuln"] = True
            events.append({"t": "respawn", "robot": r["name"], "lives": r["lives"]})


# ----------------------------------------------------------------------------
# frames
# ----------------------------------------------------------------------------
def _snapshot(robots):
    out = []
    for r in robots:
        out.append({
            "id": r["id"], "name": r["name"], "color": r["color"],
            "x": r["x"], "y": r["y"], "dir": r["dir"],
            "hp": r["hp"], "max_hp": r["max_hp"], "lives": r["lives"],
            "alive": r["alive"], "eliminated": r.get("eliminated", False),
            "shield": r.get("shield", False), "invuln": r.get("invuln", False),
        })
    return out


def _frame(slot, phase, robots, events, beams):
    return {"slot": slot, "phase": phase, "robots": _snapshot(robots),
            "events": events, "beams": beams}


def resolve_turn(board, robots_in):
    """robots_in: list of dicts with program[6]. Returns frames + final state."""
    ws = _wallset(board)
    robots = deepcopy(robots_in)
    for r in robots:
        r["shield"] = False
        r["invuln"] = False
        prog = (r.get("program") or [])[:SLOTS]
        prog = [a if a in ACTION_IDS else None for a in prog]
        prog += [None] * (SLOTS - len(prog))
        r["program"] = prog

    frames = []
    for slot in range(SLOTS):
        # 1. shields
        for r in robots:
            if r["alive"] and not r.get("eliminated"):
                r["shield"] = r["program"][slot] == "shield"

        # 2. weapons (start-of-slot positions)
        beams = []
        events = []
        dmg_map = {}
        for r in robots:
            if not r["alive"] or r.get("eliminated"):
                continue
            act = r["program"][slot]
            if act not in WEAPONS:
                continue
            events.append({"t": "fire", "robot": r["name"], "weapon": act})
            dmg, rng = WEAPONS[act]
            if act == "blast":
                hits = _fire_blast(board, robots, r, dmg, beams)
            else:
                hits = _fire_line(board, ws, robots, r, dmg, rng, beams, act)
            for hit, dv in hits:
                key = id(hit)
                prev = dmg_map.get(key, (hit, 0))[1]
                dmg_map[key] = (hit, prev + dv)
        _apply_damage(dmg_map, events)
        _resolve_deaths(board, robots, events)
        frames.append(_frame(slot, "shots", robots, events, beams))

        # 3. movement (initiative = list order)
        events = []
        for r in robots:
            if not r["alive"] or r.get("eliminated"):
                continue
            act = r["program"][slot]
            if act in ("forward", "backward", "left", "right", "uturn", "turbo"):
                _exec_action(board, ws, robots, r, act, events)
        frames.append(_frame(slot, "move", robots, events, []))

        # 4. board effects
        events = []
        beams = []
        _board_effects(board, ws, robots, events, beams)
        frames.append(_frame(slot, "board", robots, events, beams))

        # 5. deaths (holes + hp)
        events = []
        _resolve_deaths(board, robots, events)
        frames.append(_frame(slot, "resolve", robots, events, []))

        # clear per-slot shield
        for r in robots:
            r["shield"] = False

    # game over check
    survivors = [r for r in robots if not r.get("eliminated")]
    total = len(robots)
    game_over = total > 1 and len(survivors) <= 1
    winner = survivors[0]["id"] if (game_over and survivors) else None

    final = _snapshot(robots)
    for f, r in zip(final, robots):
        f["spawn"] = r["spawn"]
        f["program"] = [None] * SLOTS
    return {"frames": frames, "robots": final, "game_over": game_over, "winner": winner}

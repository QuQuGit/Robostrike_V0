"""Hand-crafted fixed boards for Robostrike V1. Directions: 0=N,1=E,2=S,3=W."""

BOARDS = {
    "foundry": {
        "id": "foundry",
        "name": "Fonderie / Foundry",
        "width": 11,
        "height": 9,
        "walls": [
            [5, 2, 2], [5, 6, 0],
            [2, 4, 1], [8, 4, 3],
            [0, 4, 2], [10, 4, 2],
        ],
        "holes": [[4, 4], [5, 4], [6, 4]],
        "conveyors": [
            {"x": 3, "y": 2, "dir": 1}, {"x": 4, "y": 2, "dir": 1},
            {"x": 5, "y": 2, "dir": 1}, {"x": 6, "y": 2, "dir": 1},
            {"x": 7, "y": 2, "dir": 1},
            {"x": 7, "y": 6, "dir": 3}, {"x": 6, "y": 6, "dir": 3},
            {"x": 5, "y": 6, "dir": 3}, {"x": 4, "y": 6, "dir": 3},
            {"x": 3, "y": 6, "dir": 3},
        ],
        "lasers": [
            {"x": 0, "y": 1, "dir": 1, "damage": 1},
            {"x": 10, "y": 7, "dir": 3, "damage": 1},
        ],
        "spawns": [
            {"x": 0, "y": 0, "dir": 1},
            {"x": 10, "y": 0, "dir": 3},
            {"x": 0, "y": 8, "dir": 1},
            {"x": 10, "y": 8, "dir": 3},
            {"x": 5, "y": 0, "dir": 2},
            {"x": 5, "y": 8, "dir": 0},
        ],
    },
    "cross": {
        "id": "cross",
        "name": "La Croix / The Cross",
        "width": 9,
        "height": 9,
        "walls": [
            [4, 3, 1], [4, 5, 3], [3, 4, 2], [5, 4, 0],
        ],
        "holes": [[4, 4], [1, 1], [7, 1], [1, 7], [7, 7]],
        "conveyors": [
            {"x": 4, "y": 1, "dir": 2}, {"x": 4, "y": 2, "dir": 2},
            {"x": 4, "y": 6, "dir": 0}, {"x": 4, "y": 7, "dir": 0},
            {"x": 1, "y": 4, "dir": 1}, {"x": 2, "y": 4, "dir": 1},
            {"x": 6, "y": 4, "dir": 3}, {"x": 7, "y": 4, "dir": 3},
        ],
        "lasers": [
            {"x": 4, "y": 0, "dir": 2, "damage": 1},
            {"x": 0, "y": 4, "dir": 1, "damage": 1},
        ],
        "spawns": [
            {"x": 0, "y": 4, "dir": 1},
            {"x": 8, "y": 4, "dir": 3},
            {"x": 4, "y": 0, "dir": 2},
            {"x": 4, "y": 8, "dir": 0},
            {"x": 0, "y": 0, "dir": 1},
            {"x": 8, "y": 8, "dir": 3},
        ],
    },
    "billboard": {
        "id": "billboard",
        "name": "Bannière / Billboard",
        "width": 12,
        "height": 9,
        "walls": [
            [4, 3, 0], [7, 3, 0],
            [4, 5, 2], [7, 5, 2],
            [4, 3, 3], [4, 5, 3],
            [7, 3, 1], [7, 5, 1],
            [1, 1, 0], [10, 1, 0],
            [1, 7, 2], [10, 7, 2],
        ],
        "holes": [[5, 4], [6, 4]],
        "conveyors": [
            {"x": 1, "y": 1, "dir": 1}, {"x": 2, "y": 1, "dir": 1},
            {"x": 3, "y": 1, "dir": 1}, {"x": 4, "y": 1, "dir": 1},
            {"x": 7, "y": 1, "dir": 3}, {"x": 8, "y": 1, "dir": 3},
            {"x": 9, "y": 1, "dir": 3}, {"x": 10, "y": 1, "dir": 3},
            {"x": 1, "y": 7, "dir": 3}, {"x": 2, "y": 7, "dir": 3},
            {"x": 3, "y": 7, "dir": 3}, {"x": 4, "y": 7, "dir": 3},
            {"x": 7, "y": 7, "dir": 1}, {"x": 8, "y": 7, "dir": 1},
            {"x": 9, "y": 7, "dir": 1}, {"x": 10, "y": 7, "dir": 1},
            {"x": 0, "y": 3, "dir": 2}, {"x": 0, "y": 4, "dir": 2}, {"x": 0, "y": 5, "dir": 2},
            {"x": 11, "y": 3, "dir": 0}, {"x": 11, "y": 4, "dir": 0}, {"x": 11, "y": 5, "dir": 0},
        ],
        "lasers": [
            {"x": 0, "y": 1, "dir": 1, "damage": 1},
            {"x": 11, "y": 7, "dir": 3, "damage": 1},
        ],
        "spawns": [
            {"x": 0, "y": 0, "dir": 1},
            {"x": 11, "y": 0, "dir": 3},
            {"x": 0, "y": 8, "dir": 1},
            {"x": 11, "y": 8, "dir": 3},
            {"x": 5, "y": 0, "dir": 2},
            {"x": 6, "y": 8, "dir": 0},
        ],
    },
    "manege": {
        "id": "manege",
        "name": "Manège / Merry-Go-Round",
        "width": 9,
        "height": 7,
        "walls": [],
        "holes": [[3, 3], [4, 4], [7, 5]],
        "conveyors": [
            {"x": 1, "y": 1, "dir": 1}, {"x": 2, "y": 1, "dir": 1},
            {"x": 3, "y": 1, "dir": 1}, {"x": 4, "y": 1, "dir": 1},
            {"x": 5, "y": 1, "dir": 1}, {"x": 6, "y": 1, "dir": 1},
            {"x": 7, "y": 1, "dir": 2}, {"x": 7, "y": 2, "dir": 2},
            {"x": 7, "y": 3, "dir": 3}, {"x": 6, "y": 3, "dir": 3},
            {"x": 5, "y": 3, "dir": 2},
            {"x": 5, "y": 4, "dir": 2},
            {"x": 5, "y": 5, "dir": 3}, {"x": 4, "y": 5, "dir": 3},
            {"x": 3, "y": 5, "dir": 3}, {"x": 2, "y": 5, "dir": 3},
            {"x": 1, "y": 5, "dir": 0}, {"x": 1, "y": 4, "dir": 0},
            {"x": 1, "y": 3, "dir": 0}, {"x": 1, "y": 2, "dir": 0},
        ],
        "lasers": [
            {"x": 0, "y": 3, "dir": 1, "damage": 1},
            {"x": 8, "y": 3, "dir": 3, "damage": 1},
        ],
        "spawns": [
            {"x": 0, "y": 0, "dir": 1},
            {"x": 8, "y": 0, "dir": 3},
            {"x": 0, "y": 6, "dir": 1},
            {"x": 8, "y": 6, "dir": 3},
        ],
    },
    "arena": {
        "id": "arena",
        "name": "Arène Ouverte / Open Arena",
        "width": 10,
        "height": 8,
        "walls": [
            [4, 3, 1], [5, 4, 3], [2, 1, 2], [7, 6, 0],
        ],
        "holes": [[2, 3], [7, 4]],
        "conveyors": [
            {"x": 0, "y": 3, "dir": 2}, {"x": 0, "y": 4, "dir": 2},
            {"x": 9, "y": 4, "dir": 0}, {"x": 9, "y": 3, "dir": 0},
        ],
        "lasers": [
            {"x": 4, "y": 0, "dir": 2, "damage": 1},
            {"x": 5, "y": 7, "dir": 0, "damage": 1},
        ],
        "spawns": [
            {"x": 0, "y": 0, "dir": 1},
            {"x": 9, "y": 7, "dir": 3},
            {"x": 9, "y": 0, "dir": 3},
            {"x": 0, "y": 7, "dir": 1},
            {"x": 4, "y": 0, "dir": 2},
            {"x": 5, "y": 7, "dir": 0},
        ],
    },
}

EXTRAS = {
    "foundry": {
        "rotators": [{"x": 2, "y": 4, "rot": 1}, {"x": 8, "y": 4, "rot": -1}],
        "pickups": [
            {"id": "p1", "type": "bomb", "x": 5, "y": 3},
            {"id": "p2", "type": "double_laser", "x": 5, "y": 5},
            {"id": "p3", "type": "shield", "x": 1, "y": 4},
            {"id": "p4", "type": "life", "x": 9, "y": 4},
        ],
    },
    "cross": {
        "rotators": [{"x": 3, "y": 3, "rot": 1}, {"x": 5, "y": 5, "rot": -1}],
        "pickups": [
            {"id": "p1", "type": "bomb", "x": 2, "y": 2},
            {"id": "p2", "type": "double_laser", "x": 6, "y": 6},
            {"id": "p3", "type": "shield", "x": 6, "y": 2},
            {"id": "p4", "type": "life", "x": 2, "y": 6},
        ],
    },
    "billboard": {
        "rotators": [{"x": 2, "y": 4, "rot": 1}, {"x": 9, "y": 4, "rot": -1}],
        "pickups": [
            {"id": "p1", "type": "double_laser", "x": 2, "y": 2},
            {"id": "p2", "type": "bomb", "x": 9, "y": 2},
            {"id": "p3", "type": "shield", "x": 2, "y": 6},
            {"id": "p4", "type": "life", "x": 9, "y": 6},
            {"id": "p5", "type": "bomb", "x": 5, "y": 3},
            {"id": "p6", "type": "shield", "x": 6, "y": 5},
        ],
    },
    "manege": {
        "rotators": [{"x": 2, "y": 2, "rot": 1}, {"x": 6, "y": 2, "rot": -1}],
        "pickups": [
            {"id": "p1", "type": "double_laser", "x": 4, "y": 1},
            {"id": "p2", "type": "bomb", "x": 4, "y": 2},
            {"id": "p3", "type": "shield", "x": 2, "y": 4},
            {"id": "p4", "type": "life", "x": 6, "y": 4},
        ],
    },
    "arena": {
        "rotators": [{"x": 3, "y": 1, "rot": 1}, {"x": 6, "y": 6, "rot": -1}],
        "pickups": [
            {"id": "p1", "type": "bomb", "x": 2, "y": 5},
            {"id": "p2", "type": "double_laser", "x": 7, "y": 2},
            {"id": "p3", "type": "shield", "x": 4, "y": 4},
            {"id": "p4", "type": "life", "x": 5, "y": 3},
        ],
    },
}
for _bid, _extra in EXTRAS.items():
    BOARDS[_bid].update(_extra)

ROBOT_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#eab308", "#a855f7", "#ec4899"]


def list_boards():
    return [{"id": b["id"], "name": b["name"], "width": b["width"], "height": b["height"]}
            for b in BOARDS.values()]


def get_board(bid):
    return BOARDS.get(bid)

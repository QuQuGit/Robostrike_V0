from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

import boards as boards_mod
from game_engine import resolve_turn, SLOTS
import rooms as rooms_mod

# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
TOKEN_DAYS = 7

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("robostrike")


# ---------------------------------------------------------------------------
# auth helpers
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def level_for(xp: int) -> int:
    return 1 + xp // 100


def public_user(u: dict) -> dict:
    xp = u.get("xp", 0)
    return {
        "id": str(u["_id"]),
        "email": u["email"],
        "username": u.get("username", "Player"),
        "role": u.get("role", "player"),
        "xp": xp,
        "level": level_for(xp),
        "stats": u.get("stats", {"games": 0, "wins": 0, "kills": 0, "deaths": 0}),
    }


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# models
# ---------------------------------------------------------------------------
class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    username: str = Field(min_length=2, max_length=24)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class RobotState(BaseModel):
    id: str
    name: str
    color: str
    x: int
    y: int
    dir: int
    hp: int
    max_hp: int
    lives: int
    alive: bool = True
    eliminated: bool = False
    spawn: dict
    invuln: bool = False
    items: List[str] = []
    program: List[Optional[str]] = []


class NewSandboxBody(BaseModel):
    board_id: str
    num_robots: int = 2


class ResolveBody(BaseModel):
    board_id: str
    robots: List[RobotState]


# ---------------------------------------------------------------------------
# auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterBody):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "username": body.username,
        "password_hash": hash_password(body.password),
        "role": "player",
        "xp": 0,
        "stats": {"games": 0, "wins": 0, "kills": 0, "deaths": 0},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"token": create_token(str(res.inserted_id), email), "user": public_user(doc)}


@api.post("/auth/login")
async def login(body: LoginBody):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_token(str(user["_id"]), email), "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------------------------------------------------------------------------
# board routes
# ---------------------------------------------------------------------------
@api.get("/boards")
async def get_boards():
    return boards_mod.list_boards()


@api.get("/boards/{board_id}")
async def get_board(board_id: str):
    b = boards_mod.get_board(board_id)
    if not b:
        raise HTTPException(status_code=404, detail="Board not found")
    return b


# ---------------------------------------------------------------------------
# sandbox routes (server authoritative engine)
# ---------------------------------------------------------------------------
def _spawn_robots(board, n):
    spawns = board["spawns"]
    n = max(2, min(n, len(spawns)))
    robots = []
    for i in range(n):
        sp = spawns[i]
        robots.append({
            "id": f"R{i+1}",
            "name": f"R{i+1}",
            "color": boards_mod.ROBOT_COLORS[i % len(boards_mod.ROBOT_COLORS)],
            "x": sp["x"], "y": sp["y"], "dir": sp["dir"],
            "hp": 5, "max_hp": 5, "lives": 3,
            "alive": True, "eliminated": False,
            "spawn": {"x": sp["x"], "y": sp["y"], "dir": sp["dir"]},
            "items": [], "invuln": False,
            "program": [None] * SLOTS,
        })
    return robots


@api.post("/sandbox/new")
async def sandbox_new(body: NewSandboxBody):
    board = boards_mod.get_board(body.board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"board": board, "robots": _spawn_robots(board, body.num_robots)}


@api.post("/sandbox/resolve")
async def sandbox_resolve(body: ResolveBody):
    board = boards_mod.get_board(body.board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    robots = [r.model_dump() for r in body.robots]
    return resolve_turn(board, robots)


# ---------------------------------------------------------------------------
# online rooms (REST + WebSocket)
# ---------------------------------------------------------------------------
class CreateRoomBody(BaseModel):
    name: Optional[str] = None
    board_id: str = "arena"
    max_players: int = 2


async def user_from_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        return None


@api.get("/rooms")
async def list_rooms(user: dict = Depends(get_current_user)):
    rooms_mod.cleanup_rooms()
    return [r.summary() for r in rooms_mod.ROOMS.values() if r.status == "lobby"]


@api.post("/rooms")
async def create_room(body: CreateRoomBody, user: dict = Depends(get_current_user)):
    if not boards_mod.get_board(body.board_id):
        raise HTTPException(status_code=404, detail="Board not found")
    u = public_user(user)
    room = rooms_mod.create_room(u, body.name, body.board_id, body.max_players)
    return room.summary()


@api.get("/rooms/{code}")
async def get_room(code: str, user: dict = Depends(get_current_user)):
    room = rooms_mod.ROOMS.get(code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room.summary()


@api.websocket("/ws/rooms/{code}")
async def room_ws(ws: WebSocket, code: str, token: str = ""):
    await ws.accept()
    user = await user_from_token(token)
    room = rooms_mod.ROOMS.get(code.upper())
    if user is None or room is None:
        await ws.send_json({"type": "error", "detail": "not_found" if user else "auth"})
        await ws.close()
        return
    u = public_user(user)
    err = await room.join(u, ws)
    if err:
        await ws.send_json({"type": "error", "detail": err})
        await ws.close()
        return
    if room.status != "lobby":
        await ws.send_json({"type": "board", "board": boards_mod.get_board(room.board_id)})
    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "leave":
                await room.disconnect(u["id"], ws, leaving=True)
                await ws.close()
                return
            await room.handle(u["id"], msg)
    except (WebSocketDisconnect, RuntimeError):
        await room.disconnect(u["id"], ws)


# ---------------------------------------------------------------------------
# leaderboard
# ---------------------------------------------------------------------------
@api.get("/leaderboard")
async def leaderboard():
    users = await db.users.find({}).sort("xp", -1).limit(50).to_list(50)
    out = []
    for i, u in enumerate(users):
        pu = public_user(u)
        pu["rank"] = i + 1
        out.append(pu)
    return out


@api.get("/")
async def root():
    return {"message": "Robostrike API online"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@robostrike.com")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email, "username": "Admin",
            "password_hash": hash_password(admin_pw), "role": "admin",
            "xp": 0, "stats": {"games": 0, "wins": 0, "kills": 0, "deaths": 0},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_pw)}})
    logger.info("Robostrike backend ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()

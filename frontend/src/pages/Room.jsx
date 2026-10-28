import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { useReplay } from "../lib/useReplay";
import { useRoomSocket } from "../lib/useRoomSocket";
import { randomProgram } from "../components/game/cards";
import GameCanvas from "../components/game/GameCanvas";
import ProgrammingPanel from "../components/game/ProgrammingPanel";
import RobotHud from "../components/game/RobotHud";
import { ChatPanel } from "../components/game/ChatPanel";
import { BoardShell, PlaybackControls, EventLog, phaseText } from "../components/game/BoardShell";
import { ArrowLeft, Copy, Crown, Check, Trophy, Timer, Send, WifiOff, Play, Mail } from "lucide-react";
import { CONTACT_EMAIL } from "../i18n_extra";

const emptyProg = () => Array(6).fill(null);
const BG = { backgroundImage: "linear-gradient(rgba(8,8,10,0.72), rgba(8,8,10,0.86)), url(/assets/machinery.jpg)" };
const FATAL = { "Room is full": "room.full", "Game already started": "room.started", not_found: "lobby.notFound" };

function RoomToolbar({ room, onLeave }) {
  const { t, lang, toggleLang } = useI18n();
  const copy = () => {
    navigator.clipboard?.writeText(room.code);
    toast.success(t("room.copied"));
  };
  return (
    <div className="rs-steel flex items-center gap-1.5 px-2 py-1.5 shrink-0">
      <button data-testid="room-leave" onClick={onLeave} className="rs-icon-btn" title={t("room.leave")}><ArrowLeft size={15} /></button>
      <h1 className="font-title text-sm text-zinc-100 uppercase tracking-wider truncate" data-testid="room-name">{room.name}</h1>
      <button data-testid="room-code-copy" onClick={copy} className="rs-mini-btn ml-auto">
        {t("room.code")} <span className="text-[#ff9a1f] tracking-[0.2em]" data-testid="room-code">{room.code}</span> <Copy size={11} />
      </button>
      <a href={`mailto:${CONTACT_EMAIL}`} data-testid="room-contact" className="rs-icon-btn" title={t("nav.contact")}><Mail size={15} /></a>
      <button data-testid="lang-toggle-room" onClick={toggleLang} className="rs-icon-btn font-title text-[11px] w-8">{lang.toUpperCase()}</button>
    </div>
  );
}

function PlayerList({ room, myId }) {
  const { t } = useI18n();
  const inGame = room.status !== "lobby";
  return (
    <div className="space-y-1.5" data-testid="player-list">
      {room.players.map((p) => (
        <div key={p.user_id} className="rs-screen rounded px-2 py-1.5 flex items-center gap-2 text-sm" data-testid={`player-${p.username}`}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || "#52525b", boxShadow: p.color ? `0 0 6px ${p.color}` : "none" }} />
          <span className="font-title truncate">{p.username}{p.user_id === myId ? " •" : ""}</span>
          {p.user_id === room.host_id && <Crown size={12} className="text-[#ff9a1f]" />}
          {!p.connected && <span className="flex items-center gap-1 text-[10px] text-red-400"><WifiOff size={10} /> {t("room.offline")}</span>}
          <span className="ml-auto font-mono-rs text-[10px]">
            {!inGame && (p.user_id === room.host_id ? t("room.host") : p.ready ? <span className="text-green-400">{t("room.ready")}</span> : <span className="text-zinc-500">{t("room.notReady")}</span>)}
            {room.status === "programming" && (p.submitted ? <span className="text-green-400 flex items-center gap-1"><Check size={11} /> {t("room.locked")}</span> : <Timer size={11} className="text-zinc-500" />)}
          </span>
        </div>
      ))}
    </div>
  );
}

function RoomLobby({ room, boards, myId, send, chat }) {
  const { t } = useI18n();
  const isHost = room.host_id === myId;
  const me = room.players.find((p) => p.user_id === myId);
  const canStart = room.players.length >= 2 && room.players.every((p) => p.ready || p.user_id === room.host_id);
  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-3 grid md:grid-cols-[1fr_300px] gap-3 items-start" data-testid="room-lobby">
      <div className="rs-steel rs-bolts rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-title uppercase tracking-wider text-sm">{t("room.waiting")}</h2>
          <span className="font-mono-rs text-xs text-zinc-400" data-testid="room-count">{room.players.length}/{room.max_players}</span>
        </div>
        <PlayerList room={room} myId={myId} />
        {isHost && (
          <div className="flex gap-2">
            <select data-testid="room-settings-board" value={room.board_id} onChange={(e) => send({ type: "settings", board_id: e.target.value, max_players: room.max_players })} className="rs-select flex-1 min-w-0">
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select data-testid="room-settings-max" value={room.max_players} onChange={(e) => send({ type: "settings", board_id: room.board_id, max_players: Number(e.target.value) })} className="rs-select">
              {[2, 3, 4].map((n) => <option key={n} value={n}>{n} {t("lobby.players")}</option>)}
            </select>
          </div>
        )}
        {!isHost && <p className="font-mono-rs text-xs text-zinc-400">{t("lobby.board")} : {boards.find((b) => b.id === room.board_id)?.name}</p>}
        <div className="flex gap-2 pt-1">
          {!isHost && (
            <button data-testid="ready-btn" onClick={() => send({ type: "ready", ready: !me?.ready })} className={`rs-go-btn ${me?.ready ? "rs-go-purple" : ""}`}>
              <Check size={14} /> {me?.ready ? t("room.notReady") : t("room.ready")}
            </button>
          )}
          {isHost && (
            <button data-testid="start-btn" disabled={!canStart} onClick={() => send({ type: "start" })} className="rs-go-btn disabled:opacity-40">
              <Play size={14} className="fill-current" /> {t("room.start")}
            </button>
          )}
        </div>
        {isHost && !canStart && <p className="text-[11px] text-zinc-500">{t("room.needReady")}</p>}
      </div>
      <ChatPanel chat={chat} onSend={(text) => send({ type: "chat", text })} className="md:h-[420px]" />
    </div>
  );
}

export default function Room() {
  const { code } = useParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [board, setBoard] = useState(null);
  const [boards, setBoards] = useState([]);
  const [chat, setChat] = useState([]);
  const [program, setProgram] = useState(emptyProg());
  const [endsAt, setEndsAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const replay = useReplay("rs_speed_online", 4);
  const turnRef = useRef(0);
  const doneRef = useRef(0);
  const resultTurn = useRef(0);

  useEffect(() => { api.get("/boards").then((r) => setBoards(r.data)); }, []);

  const { send } = useRoomSocket(code, (msg) => {
    if (msg.type === "room") {
      const r = msg.room;
      setRoom(r);
      setChat(r.chat || []);
      if (r.status === "programming" && r.turn !== turnRef.current) {
        turnRef.current = r.turn;
        setProgram(emptyProg());
        replay.clear();
      }
      if (r.status === "programming" && r.seconds_left != null) setEndsAt(Date.now() + r.seconds_left * 1000);
      if (r.status === "finished" || r.status === "lobby") replay.clear();
    } else if (msg.type === "board") setBoard(msg.board);
    else if (msg.type === "chat") setChat((c) => [...c, msg.msg].slice(-50));
    else if (msg.type === "turn_result") {
      resultTurn.current = msg.turn;
      replay.start(msg.frames);
    } else if (msg.type === "error") {
      if (FATAL[msg.detail]) { toast.error(t(FATAL[msg.detail])); navigate("/lobby"); }
      else if (msg.detail === "not_ready") toast.error(t("room.needReady"));
      else toast.error(msg.detail);
    }
  });

  useEffect(() => {
    if (room?.status !== "programming") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [room?.status]);

  // tell the server when this client finished watching the turn
  useEffect(() => {
    if (replay.ended && !replay.playing && room?.status === "resolving" && doneRef.current !== resultTurn.current) {
      doneRef.current = resultTurn.current;
      send({ type: "replay_done" });
    }
  }, [replay.ended, replay.playing, room?.status, send]);

  if (!room) return <div className="rs-machinery min-h-screen grid place-items-center font-mono-rs text-zinc-400" style={BG} data-testid="room-loading">…</div>;

  const leave = () => { send({ type: "leave" }); navigate("/lobby"); };
  const me = room.players.find((p) => p.user_id === user?.id);
  const myId = user?.id;

  if (room.status === "lobby" || !board) {
    return (
      <div className="rs-machinery min-h-screen flex flex-col" style={BG} data-testid="room-page">
        <RoomToolbar room={room} onLeave={leave} />
        <RoomLobby room={room} boards={boards} myId={myId} send={send} chat={chat} />
      </div>
    );
  }

  const curFrame = replay.frames ? replay.frames[replay.frameIdx] : null;
  const display = curFrame ? curFrame.robots : room.robots;
  const myIdx = display.findIndex((r) => r.id === me?.robot_id);
  const myRobot = room.robots.find((r) => r.id === me?.robot_id);
  const mySubmitted = me && room.players.find((p) => p.user_id === myId)?.submitted;
  const canProgram = room.status === "programming" && myRobot && !myRobot.eliminated && !mySubmitted && !curFrame;
  const secs = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  const update = (fn) => setProgram((p) => {
    const n = fn([...p]);
    send({ type: "program", program: n, final: false });
    return n;
  });
  const submit = () => send({ type: "program", program, final: true });

  const status = curFrame ? phaseText(t, curFrame, "") : room.status === "finished" ? t("sandbox.gameover") : t("game.programming");
  const footer = curFrame ? (
    <>
      <PlaybackControls replay={replay} />
      {replay.ended && room.status === "resolving" && <span className="font-mono-rs text-[11px] text-[#ff9a1f] px-1" data-testid="waiting-others">{t("room.waitOthers")}</span>}
    </>
  ) : room.status === "programming" ? (
    <>
      <span className={`font-title text-sm px-2 flex items-center gap-1 ${secs <= 10 ? "text-red-400" : "text-zinc-100"}`} data-testid="room-timer">
        <Timer size={14} /> {t("room.timeLeft", { s: secs })}
      </span>
      {canProgram && (
        <button data-testid="submit-program-btn" onClick={submit} className="rs-go-btn"><Send size={13} /> {t("room.submit")}</button>
      )}
      {mySubmitted && <span className="font-mono-rs text-[11px] text-green-400 px-1" data-testid="submitted-label">{t("room.submitted")}</span>}
    </>
  ) : <span className="font-mono-rs text-[11px] text-zinc-400 px-2">—</span>;

  return (
    <div className="rs-machinery min-h-screen lg:h-screen lg:overflow-hidden flex flex-col" style={BG} data-testid="room-page">
      <RoomToolbar room={room} onLeave={leave} />
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 p-2">
        <BoardShell status={status} right={`${t("game.turn")}: ${room.turn}`} footer={footer}>
          <GameCanvas board={board} robots={display} beams={curFrame ? curFrame.beams : []} events={curFrame?.events}
            activeId={me?.robot_id} taken={curFrame ? curFrame.taken || [] : []} />
        </BoardShell>
        <div className="lg:w-[400px] xl:w-[440px] shrink-0 flex flex-col gap-2 lg:min-h-0 lg:overflow-y-auto">
          <RobotHud robots={display} programs={display.map((_, i) => (i === myIdx ? program : []))} activeIdx={myIdx} onSelect={() => {}} />
          {room.status === "finished" && !curFrame && (
            <div className="rs-steel rounded-md p-2 flex items-center gap-2 flex-wrap" style={{ borderColor: "#ff9a1f" }} data-testid="gameover-banner">
              <Trophy size={18} className="text-[#ff9a1f]" />
              <p className="font-title text-sm text-[#ff9a1f] uppercase">{t("sandbox.gameover")}</p>
              {room.winner ? <p className="font-mono-rs text-xs">{t("sandbox.winner", { name: room.winner })}</p> : <p className="font-mono-rs text-xs" data-testid="draw-label">{t("room.draw")}</p>}
              {room.host_id === myId && (
                <button data-testid="rematch-btn" onClick={() => send({ type: "start" })} className="rs-go-btn rs-go-purple ml-auto">{t("room.backLobby")}</button>
              )}
            </div>
          )}
          {room.status === "programming" && <PlayerList room={room} myId={myId} />}
          {canProgram && (
            <>
              <ProgrammingPanel
                program={program}
                robot={myRobot}
                onAdd={(id) => update((p) => { const k = p.findIndex((s) => s === null); if (k !== -1) p[k] = id; return p; })}
                onRemove={(i) => update((p) => { p[i] = null; return p; })}
                onRandom={() => update(() => randomProgram(myRobot.items))}
                onClear={() => update(() => emptyProg())}
              />
              <p className="text-[10px] text-zinc-500 px-1" data-testid="penalty-hint">{t("room.penaltyHint")}</p>
            </>
          )}
          {myRobot?.eliminated && <p className="rs-screen rounded p-2 text-xs text-zinc-400" data-testid="spectator-note">{t("room.spectator")}</p>}
          <EventLog frame={curFrame} />
          <ChatPanel chat={chat} onSend={(text) => send({ type: "chat", text })} className="lg:flex-1" />
        </div>
      </div>
    </div>
  );
}

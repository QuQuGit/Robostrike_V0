import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { Users, Plus, LogIn, RefreshCw, Map } from "lucide-react";

const BG = { backgroundImage: "linear-gradient(rgba(8,8,10,0.72), rgba(8,8,10,0.86)), url(/assets/machinery.jpg)" };

function CreateRoom({ boards, onCreated }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [boardId, setBoardId] = useState("arena");
  const [max, setMax] = useState(2);
  const create = async () => {
    const { data } = await api.post("/rooms", { name: name || null, board_id: boardId, max_players: max });
    onCreated(data.code);
  };
  return (
    <div className="rs-steel rs-bolts rounded-lg p-4 space-y-3" data-testid="create-room">
      <h2 className="font-title uppercase tracking-wider text-sm flex items-center gap-2"><Plus size={15} className="text-[#ff9a1f]" /> {t("lobby.create")}</h2>
      <input data-testid="room-name-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={32}
        placeholder={t("lobby.roomName")} className="rs-select w-full" />
      <div className="flex gap-2">
        <select data-testid="room-board-select" value={boardId} onChange={(e) => setBoardId(e.target.value)} className="rs-select flex-1 min-w-0">
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select data-testid="room-max-select" value={max} onChange={(e) => setMax(Number(e.target.value))} className="rs-select">
          {[2, 3, 4].map((n) => <option key={n} value={n}>{n} {t("lobby.players")}</option>)}
        </select>
      </div>
      <button data-testid="create-room-btn" onClick={create} className="rs-go-btn w-full justify-center">{t("lobby.create")}</button>
    </div>
  );
}

function JoinByCode({ onJoin }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  return (
    <div className="rs-steel rs-bolts rounded-lg p-4 space-y-3">
      <h2 className="font-title uppercase tracking-wider text-sm flex items-center gap-2"><LogIn size={15} className="text-[#c14dff]" /> {t("lobby.code")}</h2>
      <div className="flex gap-2">
        <input data-testid="join-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={5}
          placeholder="ABCDE" className="rs-select flex-1 min-w-0 tracking-[0.3em] uppercase" />
        <button data-testid="join-code-btn" disabled={code.length !== 5} onClick={() => onJoin(code)} className="rs-go-btn rs-go-purple">{t("lobby.join")}</button>
      </div>
    </div>
  );
}

export default function Lobby() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [boards, setBoards] = useState([]);
  const boardName = (id) => boards.find((b) => b.id === id)?.name || id;

  const load = useCallback(() => api.get("/rooms").then((r) => setRooms(r.data)), []);
  useEffect(() => {
    api.get("/boards").then((r) => setBoards(r.data));
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  const joinCode = async (code) => {
    try {
      await api.get(`/rooms/${code}`);
      navigate(`/room/${code}`);
    } catch {
      toast.error(t("lobby.notFound"));
    }
  };

  return (
    <div className="rs-machinery min-h-[calc(100vh-56px)]" style={BG} data-testid="lobby-page">
      <div className="max-w-5xl mx-auto px-3 py-6 grid md:grid-cols-[1fr_320px] gap-4">
        <div className="rs-steel rs-bolts rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-title text-lg uppercase tracking-wider flex items-center gap-2"><Users size={18} className="text-[#ff9a1f]" /> {t("lobby.title")}</h1>
            <button data-testid="rooms-refresh" onClick={load} className="rs-icon-btn" title={t("lobby.refresh")}><RefreshCw size={14} /></button>
          </div>
          <div className="space-y-2" data-testid="rooms-list">
            {rooms.length === 0 && <p className="rs-screen rounded p-4 text-sm text-zinc-500 text-center" data-testid="rooms-empty">{t("lobby.empty")}</p>}
            {rooms.map((r) => (
              <div key={r.code} className="rs-screen rounded-md p-3 flex items-center gap-3" data-testid={`room-row-${r.code}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-title text-sm truncate">{r.name}</p>
                  <p className="font-mono-rs text-[11px] text-zinc-400 flex items-center gap-2">
                    <Map size={11} /> {boardName(r.board_id)} · <span className="text-[#ff9a1f]">{r.code}</span>
                  </p>
                </div>
                <span className="font-mono-rs text-xs text-zinc-300">{r.players}/{r.max_players}</span>
                <button data-testid={`join-room-${r.code}`} disabled={r.players >= r.max_players} onClick={() => navigate(`/room/${r.code}`)} className="rs-go-btn">
                  {t("lobby.join")}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <CreateRoom boards={boards} onCreated={(code) => navigate(`/room/${code}`)} />
          <JoinByCode onJoin={joinCode} />
        </div>
      </div>
    </div>
  );
}

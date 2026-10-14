import React, { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { ACTIONS } from "../components/game/cards";
import GameCanvas from "../components/game/GameCanvas";
import ProgrammingPanel from "../components/game/ProgrammingPanel";
import RobotHud from "../components/game/RobotHud";
import {
  Play, Pause, SkipBack, SkipForward, RefreshCw, Swords, Trophy,
} from "lucide-react";

const SLOTS = 6;
const emptyProg = () => Array(SLOTS).fill(null);

export default function Sandbox() {
  const { t } = useI18n();
  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState("arena");
  const [numRobots, setNumRobots] = useState(2);
  const [board, setBoard] = useState(null);
  const [robots, setRobots] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [frames, setFrames] = useState(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);

  const startSandbox = useCallback(async (bid, n) => {
    const { data } = await api.post("/sandbox/new", { board_id: bid, num_robots: n });
    setBoard(data.board);
    setRobots(data.robots);
    setPrograms(data.robots.map(() => emptyProg()));
    setActiveIdx(0);
    setFrames(null);
    setFrameIdx(0);
    setPlaying(false);
    setResult(null);
  }, []);

  useEffect(() => {
    api.get("/boards").then((r) => setBoards(r.data));
  }, []);

  useEffect(() => {
    startSandbox(boardId, numRobots);
  }, [boardId, numRobots, startSandbox]);

  // playback
  useEffect(() => {
    if (!playing || !frames) return;
    if (frameIdx >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setFrameIdx((i) => i + 1), 650);
    return () => clearTimeout(id);
  }, [playing, frames, frameIdx]);

  const display = frames ? frames[frameIdx].robots : robots;
  const beams = frames ? frames[frameIdx].beams : [];
  const locked = !!frames;

  const addAction = (id) => {
    setPrograms((ps) => {
      const copy = ps.map((p) => [...p]);
      const slot = copy[activeIdx].findIndex((s) => s === null);
      if (slot !== -1) copy[activeIdx][slot] = id;
      return copy;
    });
  };
  const removeSlot = (i) => {
    setPrograms((ps) => {
      const copy = ps.map((p) => [...p]);
      copy[activeIdx][i] = null;
      return copy;
    });
  };
  const randomFill = () => {
    setPrograms((ps) => {
      const copy = ps.map((p) => [...p]);
      copy[activeIdx] = Array.from({ length: SLOTS }, () =>
        ACTIONS[Math.floor(Math.random() * ACTIONS.length)].id
      );
      return copy;
    });
  };
  const clearActive = () => {
    setPrograms((ps) => {
      const copy = ps.map((p) => [...p]);
      copy[activeIdx] = emptyProg();
      return copy;
    });
  };

  const resolve = async () => {
    const ready = programs.every((p, i) => robots[i].eliminated || p.filter(Boolean).length === SLOTS);
    if (!ready) {
      toast.error(t("sandbox.allReady"));
      return;
    }
    const payload = robots.map((r, i) => ({ ...r, program: programs[i] }));
    const { data } = await api.post("/sandbox/resolve", { board_id: boardId, robots: payload });
    setFrames(data.frames);
    setFrameIdx(0);
    setResult(data);
    setPlaying(true);
  };

  const newTurn = () => {
    if (!result) return;
    setRobots(result.robots);
    setPrograms(result.robots.map(() => emptyProg()));
    setFrames(null);
    setFrameIdx(0);
    setPlaying(false);
    setActiveIdx(result.robots.findIndex((r) => !r.eliminated) || 0);
  };

  const winnerName =
    result?.winner && robots.find((r) => r.id === result.winner)?.name;

  const curFrame = frames ? frames[frameIdx] : null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6" data-testid="sandbox-page">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="font-display text-2xl text-white flex items-center gap-2">
          <Swords className="text-[#f97316]" /> {t("sandbox.title")}
        </h1>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <select
            data-testid="board-select"
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            className="bg-[#1c1c22] border border-border rounded-sm px-3 py-1.5 text-sm font-mono-rs"
          >
            {boards.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            data-testid="robots-select"
            value={numRobots}
            onChange={(e) => setNumRobots(Number(e.target.value))}
            className="bg-[#1c1c22] border border-border rounded-sm px-3 py-1.5 text-sm font-mono-rs"
          >
            {[2, 3, 4].map((n) => (
              <option key={n} value={n}>{n} {t("sandbox.robots")}</option>
            ))}
          </select>
          <button
            data-testid="sandbox-reset"
            onClick={() => startSandbox(boardId, numRobots)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border text-sm text-muted-foreground hover:text-white"
          >
            <RefreshCw size={14} /> {t("sandbox.reset")}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        {/* board + playback */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rs-panel rounded-sm p-3 rs-noise">
            {board && <GameCanvas board={board} robots={display} beams={beams} />}
          </div>

          {/* playback controls */}
          <div className="rs-panel rounded-sm p-3 flex items-center gap-2 flex-wrap">
            {!locked ? (
              <button
                data-testid="resolve-btn"
                onClick={resolve}
                className="flex items-center gap-2 px-5 py-2 rounded-sm bg-[#f97316] text-black font-bold uppercase tracking-widest text-sm hover:bg-[#ea580c] rs-glow-orange"
              >
                <Play size={15} /> {t("sandbox.resolve")}
              </button>
            ) : (
              <>
                <button data-testid="step-prev" onClick={() => { setPlaying(false); setFrameIdx((i) => Math.max(0, i - 1)); }}
                  className="p-2 rounded-sm border border-border hover:text-[#f97316]"><SkipBack size={16} /></button>
                <button data-testid="step-play" onClick={() => setPlaying((p) => !p)}
                  className="p-2 rounded-sm border border-border hover:text-[#f97316]">
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button data-testid="step-next" onClick={() => { setPlaying(false); setFrameIdx((i) => Math.min(frames.length - 1, i + 1)); }}
                  className="p-2 rounded-sm border border-border hover:text-[#f97316]"><SkipForward size={16} /></button>
                <div className="font-mono-rs text-xs text-muted-foreground px-2">
                  {t("sandbox.frame", { i: frameIdx + 1, n: frames.length })}
                  {curFrame && (
                    <span className="ml-2 text-[#8b5cf6]">
                      S{curFrame.slot + 1} · {t(`phase.${curFrame.phase}`)}
                    </span>
                  )}
                </div>
                <button
                  data-testid="new-turn-btn"
                  onClick={newTurn}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-sm border border-[#8b5cf6] text-[#8b5cf6] text-sm uppercase tracking-wider hover:bg-[#8b5cf6]/10"
                >
                  <RefreshCw size={14} /> {t("sandbox.newTurn")}
                </button>
              </>
            )}
          </div>

          {result?.game_over && (
            <div className="rs-panel rounded-sm p-4 border-[#f97316] flex items-center gap-3" data-testid="gameover-banner">
              <Trophy className="text-[#f97316]" />
              <div>
                <p className="font-display text-[#f97316]">{t("sandbox.gameover")}</p>
                {winnerName && <p className="font-mono-rs text-sm">{t("sandbox.winner", { name: winnerName })}</p>}
              </div>
            </div>
          )}
        </div>

        {/* side: robots + programming + log */}
        <div className="lg:col-span-4 space-y-4">
          <RobotHud robots={display} programs={programs} activeIdx={activeIdx} onSelect={setActiveIdx} />

          {!locked && robots[activeIdx] && !robots[activeIdx].eliminated && (
            <ProgrammingPanel
              program={programs[activeIdx] || emptyProg()}
              onAdd={addAction}
              onRemove={removeSlot}
              onRandom={randomFill}
              onClear={clearActive}
            />
          )}

          {/* log */}
          <div className="rs-panel rounded-sm p-4" data-testid="event-log">
            <h3 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground mb-2">
              {t("sandbox.log")}
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto font-mono-rs text-xs">
              {curFrame && curFrame.events.length === 0 && (
                <p className="text-muted-foreground/50">—</p>
              )}
              {curFrame &&
                curFrame.events.map((e, i) => {
                  const vars = { ...e };
                  if (e.weapon) vars.weapon = t(`act.${e.weapon}`);
                  return (
                    <p key={i} className="text-muted-foreground">
                      <span className="text-[#8b5cf6]">›</span> {t(`ev.${e.t}`, vars)}
                    </p>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

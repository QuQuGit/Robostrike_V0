import React, { useEffect, useState, useCallback } from "react";
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
  const [turn, setTurn] = useState(1);

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
    setTurn(1);
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
    setTurn((n) => n + 1);
    setActiveIdx(result.robots.findIndex((r) => !r.eliminated) || 0);
  };

  const winnerName =
    result?.winner && robots.find((r) => r.id === result.winner)?.name;

  const curFrame = frames ? frames[frameIdx] : null;

  const activeRobot = robots[activeIdx];
  const plans = locked ? [] : robots
    .map((r, i) => ({ id: r.id, color: r.color, x: r.x, y: r.y, dir: r.dir, program: programs[i] || [], width: board?.width, height: board?.height, eliminated: r.eliminated }))
    .filter((p) => !p.eliminated && p.program.some(Boolean));

  return (
    <div className="rs-machinery min-h-[calc(100vh-57px)]" style={{ backgroundImage: "linear-gradient(rgba(8,8,10,0.72), rgba(8,8,10,0.86)), url(/assets/machinery.jpg)" }} data-testid="sandbox-page">
      <div className="max-w-[1500px] mx-auto px-2 sm:px-4 py-3 sm:py-5">
        <div className="rs-steel rs-bolts rounded-lg flex flex-wrap items-center gap-2 px-3 py-2 mb-3 sm:mb-4">
          <h1 className="font-title text-base sm:text-lg text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
            <Swords size={18} className="text-[#ff9a1f]" /> {t("sandbox.title")}
          </h1>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select data-testid="board-select" value={boardId} onChange={(e) => setBoardId(e.target.value)} className="rs-select">
              {boards.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
            <select data-testid="robots-select" value={numRobots} onChange={(e) => setNumRobots(Number(e.target.value))} className="rs-select">
              {[2, 3, 4].map((n) => (<option key={n} value={n}>{n} {t("sandbox.robots")}</option>))}
            </select>
            <button data-testid="sandbox-reset" onClick={() => startSandbox(boardId, numRobots)} className="rs-mini-btn">
              <RefreshCw size={12} /> {t("sandbox.reset")}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:gap-4 lg:grid lg:grid-cols-12 lg:grid-rows-[min-content_1fr_auto] lg:items-start">
          {/* framed board */}
          <div className="lg:col-span-8 lg:row-start-1 lg:row-span-2 order-1 rs-steel rs-bolts rounded-xl px-1.5 sm:px-3 pb-2 pt-0 relative" data-testid="board-shell">
            <div className="flex justify-center">
              <div className="rs-title-plate" data-testid="board-title">ROBOSTRIKE</div>
            </div>
            <div className="rs-screen rounded-md flex items-center justify-between px-3 py-1.5 my-2 font-title text-[11px] sm:text-sm uppercase tracking-[0.18em]">
              <span className="text-zinc-100" data-testid="phase-label">
                {curFrame ? `${t("game.resolving")} · S${curFrame.slot + 1} · ${t(`phase.${curFrame.phase}`)}` : t("game.programming")}
              </span>
              <span className="text-zinc-100" data-testid="turn-label">{t("game.turn")}: {turn}</span>
            </div>
            {board && <GameCanvas board={board} robots={display} beams={beams} plans={plans} activeId={activeRobot?.id} />}

            {/* bottom tab: playback */}
            <div className="flex justify-center mt-2">
              <div className="rs-screen rounded-md flex items-center gap-2 px-2 py-1.5 flex-wrap justify-center">
                {!locked ? (
                  <button data-testid="resolve-btn" onClick={resolve} className="rs-go-btn">
                    <Play size={15} className="fill-current" /> {t("sandbox.resolve")}
                  </button>
                ) : (
                  <>
                    <button data-testid="step-prev" onClick={() => { setPlaying(false); setFrameIdx((i) => Math.max(0, i - 1)); }} className="rs-icon-btn"><SkipBack size={16} /></button>
                    <button data-testid="step-play" onClick={() => setPlaying((p) => !p)} className="rs-icon-btn">
                      {playing ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button data-testid="step-next" onClick={() => { setPlaying(false); setFrameIdx((i) => Math.min(frames.length - 1, i + 1)); }} className="rs-icon-btn"><SkipForward size={16} /></button>
                    <span className="font-mono-rs text-xs text-zinc-300 px-1" data-testid="frame-label">{t("sandbox.frame", { i: frameIdx + 1, n: frames.length })}</span>
                    <button data-testid="new-turn-btn" onClick={newTurn} className="rs-go-btn rs-go-purple">
                      <RefreshCw size={14} /> {t("sandbox.newTurn")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* robots */}
          <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1 order-2 space-y-3">
            <RobotHud robots={display} programs={programs} activeIdx={activeIdx} onSelect={setActiveIdx} />
            {result?.game_over && (
              <div className="rs-steel rounded-md p-3 flex items-center gap-3" style={{ borderColor: "#ff9a1f" }} data-testid="gameover-banner">
                <Trophy className="text-[#ff9a1f]" />
                <div>
                  <p className="font-title text-[#ff9a1f] uppercase">{t("sandbox.gameover")}</p>
                  {winnerName && <p className="font-mono-rs text-sm">{t("sandbox.winner", { name: winnerName })}</p>}
                </div>
              </div>
            )}
          </div>

          {/* card console */}
          <div className="lg:col-span-8 lg:row-start-3 order-3">
            {!locked && activeRobot && !activeRobot.eliminated && (
              <ProgrammingPanel
                program={programs[activeIdx] || emptyProg()}
                robot={activeRobot}
                onAdd={addAction}
                onRemove={removeSlot}
                onRandom={randomFill}
                onClear={clearActive}
              />
            )}
          </div>

          {/* log */}
          <div className="lg:col-span-4 lg:col-start-9 lg:row-start-2 lg:self-start order-4 rs-steel rounded-md p-3" data-testid="event-log">
            <h3 className="font-title text-xs uppercase tracking-[0.2em] text-zinc-400 mb-2">{t("sandbox.log")}</h3>
            <div className="rs-screen rounded p-2 space-y-1 max-h-48 lg:max-h-[420px] overflow-y-auto font-mono-rs text-xs min-h-[3rem]">
              {(!curFrame || curFrame.events.length === 0) && <p className="text-zinc-600">—</p>}
              {curFrame && curFrame.events.map((e, i) => {
                const vars = { ...e };
                if (e.weapon) vars.weapon = t(`act.${e.weapon}`);
                return (
                  <p key={i} className="text-zinc-300"><span className="text-[#c14dff]">›</span> {t(`ev.${e.t}`, vars)}</p>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

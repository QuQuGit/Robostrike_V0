import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { randomProgram } from "../components/game/cards";
import { useNavigate } from "react-router-dom";
import GameCanvas from "../components/game/GameCanvas";
import ProgrammingPanel from "../components/game/ProgrammingPanel";
import RobotHud from "../components/game/RobotHud";
import {
  Play, Pause, SkipBack, SkipForward, RefreshCw, Swords, Trophy, ArrowLeft,
} from "lucide-react";

const SLOTS = 6;
const emptyProg = () => Array(SLOTS).fill(null);

export default function Sandbox() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
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
      copy[activeIdx] = randomProgram(robots[activeIdx]?.items);
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
  const taken = curFrame ? curFrame.taken || [] : [];

  const activeRobot = robots[activeIdx];
  const plans = locked ? [] : robots
    .map((r, i) => ({ id: r.id, color: r.color, x: r.x, y: r.y, dir: r.dir, program: programs[i] || [], width: board?.width, height: board?.height, eliminated: r.eliminated }))
    .filter((p) => !p.eliminated && p.program.some(Boolean));

  return (
    <div className="rs-machinery min-h-screen lg:h-screen lg:overflow-hidden flex flex-col" style={{ backgroundImage: "linear-gradient(rgba(8,8,10,0.72), rgba(8,8,10,0.86)), url(/assets/machinery.jpg)" }} data-testid="sandbox-page">
      {/* compact game toolbar (site header hidden in game) */}
      <div className="rs-steel flex flex-wrap items-center gap-1.5 px-2 py-1.5 shrink-0">
        <button data-testid="sandbox-exit" onClick={() => navigate("/home")} className="rs-icon-btn" title={t("nav.home")}><ArrowLeft size={15} /></button>
        <h1 className="font-title text-sm text-zinc-100 flex items-center gap-1.5 uppercase tracking-wider">
          <Swords size={15} className="text-[#ff9a1f]" /> <span className="hidden sm:inline">{t("sandbox.title")}</span>
        </h1>
        <div className="flex items-center gap-1.5 ml-auto">
          <select data-testid="board-select" value={boardId} onChange={(e) => setBoardId(e.target.value)} className="rs-select">
            {boards.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <select data-testid="robots-select" value={numRobots} onChange={(e) => setNumRobots(Number(e.target.value))} className="rs-select">
            {[2, 3, 4].map((n) => (<option key={n} value={n}>{n} {t("sandbox.robots")}</option>))}
          </select>
          <button data-testid="sandbox-reset" onClick={() => startSandbox(boardId, numRobots)} className="rs-icon-btn" title={t("sandbox.reset")}><RefreshCw size={15} /></button>
          <button data-testid="lang-toggle-game" onClick={() => setLang(lang === "fr" ? "en" : "fr")} className="rs-icon-btn font-title text-[11px] w-8">{lang === "fr" ? "EN" : "FR"}</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 p-2">
        {/* framed board */}
        <div className="lg:flex-1 min-w-0 rs-steel rs-bolts rounded-xl px-1.5 sm:px-2.5 pb-1.5 flex flex-col" data-testid="board-shell">
          <div className="flex justify-center">
            <div className="rs-title-plate" data-testid="board-title">ROBOSTRIKE</div>
          </div>
          <div className="rs-screen rounded-md flex items-center justify-between px-2.5 py-1 my-1.5 font-title text-[10px] sm:text-xs uppercase tracking-[0.16em]">
            <span className="text-zinc-100 truncate" data-testid="phase-label">
              {curFrame ? `${t("game.resolving")} · S${curFrame.slot + 1} · ${t(`phase.${curFrame.phase}`)}` : t("game.programming")}
            </span>
            <span className="text-zinc-100 shrink-0 ml-2" data-testid="turn-label">{t("game.turn")}: {turn}</span>
          </div>
          <div className="flex-1 min-h-0 flex items-center">
            {board && <GameCanvas board={board} robots={display} beams={beams} plans={plans} activeId={activeRobot?.id} taken={taken} />}
          </div>
          <div className="flex justify-center mt-1.5">
            <div className="rs-screen rounded-md flex items-center gap-1.5 px-1.5 py-1 flex-wrap justify-center">
              {!locked ? (
                <button data-testid="resolve-btn" onClick={resolve} className="rs-go-btn">
                  <Play size={13} className="fill-current" /> {t("sandbox.resolve")}
                </button>
              ) : (
                <>
                  <button data-testid="step-prev" onClick={() => { setPlaying(false); setFrameIdx((i) => Math.max(0, i - 1)); }} className="rs-icon-btn"><SkipBack size={14} /></button>
                  <button data-testid="step-play" onClick={() => setPlaying((p) => !p)} className="rs-icon-btn">
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button data-testid="step-next" onClick={() => { setPlaying(false); setFrameIdx((i) => Math.min(frames.length - 1, i + 1)); }} className="rs-icon-btn"><SkipForward size={14} /></button>
                  <span className="font-mono-rs text-[11px] text-zinc-300 px-1" data-testid="frame-label">{t("sandbox.frame", { i: frameIdx + 1, n: frames.length })}</span>
                  <button data-testid="new-turn-btn" onClick={newTurn} className="rs-go-btn rs-go-purple">
                    <RefreshCw size={13} /> {t("sandbox.newTurn")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* side column: robots, console, log */}
        <div className="lg:w-[400px] xl:w-[440px] shrink-0 flex flex-col gap-2 lg:min-h-0 lg:overflow-y-auto">
          <RobotHud robots={display} programs={programs} activeIdx={activeIdx} onSelect={setActiveIdx} />
          {result?.game_over && (
            <div className="rs-steel rounded-md p-2 flex items-center gap-2" style={{ borderColor: "#ff9a1f" }} data-testid="gameover-banner">
              <Trophy size={18} className="text-[#ff9a1f]" />
              <p className="font-title text-sm text-[#ff9a1f] uppercase">{t("sandbox.gameover")}</p>
              {winnerName && <p className="font-mono-rs text-xs">{t("sandbox.winner", { name: winnerName })}</p>}
            </div>
          )}
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
          <div className="rs-steel rounded-md p-2 lg:flex-1 lg:min-h-[110px] flex flex-col" data-testid="event-log">
            <h3 className="font-title text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-1">{t("sandbox.log")}</h3>
            <div className="rs-screen rounded p-1.5 space-y-0.5 max-h-40 lg:max-h-none lg:flex-1 overflow-y-auto font-mono-rs text-[11px] min-h-[2.5rem]">
              {(!curFrame || curFrame.events.length === 0) && <p className="text-zinc-600">—</p>}
              {curFrame && curFrame.events.map((e, i) => {
                const vars = { ...e };
                if (e.weapon) vars.weapon = t(`act.${e.weapon}`);
                if (e.item) vars.item = t(`item.${e.item}`);
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

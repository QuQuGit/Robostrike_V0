import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { randomProgram } from "../components/game/cards";
import { useNavigate } from "react-router-dom";
import GameCanvas from "../components/game/GameCanvas";
import ProgrammingPanel from "../components/game/ProgrammingPanel";
import RobotHud from "../components/game/RobotHud";
import { BoardShell, PlaybackControls, EventLog, phaseText } from "../components/game/BoardShell";
import { useReplay } from "../lib/useReplay";
import { Play, RefreshCw, Swords, Trophy, ArrowLeft, Mail } from "lucide-react";
import { CONTACT_EMAIL } from "../i18n_extra";

const SLOTS = 6;
const emptyProg = () => Array(SLOTS).fill(null);

export default function Sandbox() {
  const { t, lang, toggleLang } = useI18n();
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState("arena");
  const [numRobots, setNumRobots] = useState(2);
  const [board, setBoard] = useState(null);
  const [robots, setRobots] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const replay = useReplay("rs_speed_sandbox", 1);
  const { frames, frameIdx, clear: clearReplay } = replay;
  const [result, setResult] = useState(null);
  const [turn, setTurn] = useState(1);

  const startSandbox = useCallback(async (bid, n) => {
    const { data } = await api.post("/sandbox/new", { board_id: bid, num_robots: n });
    setBoard(data.board);
    setRobots(data.robots);
    setPrograms(data.robots.map(() => emptyProg()));
    setActiveIdx(0);
    clearReplay();
    setResult(null);
    setTurn(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.get("/boards").then((r) => setBoards(r.data));
  }, []);

  useEffect(() => {
    startSandbox(boardId, numRobots);
  }, [boardId, numRobots, startSandbox]);

  const curFrame = frames ? frames[frameIdx] : null;
  const display = curFrame ? curFrame.robots : robots;
  const beams = curFrame ? curFrame.beams : [];
  const taken = curFrame ? curFrame.taken || [] : [];
  const locked = !!frames;

  const editActive = (fn) => setPrograms((ps) => ps.map((p, i) => (i === activeIdx ? fn([...p]) : p)));
  const addAction = (id) => editActive((p) => {
    const slot = p.findIndex((s) => s === null);
    if (slot !== -1) p[slot] = id;
    return p;
  });
  const removeSlot = (i) => editActive((p) => { p[i] = null; return p; });
  const randomFill = () => editActive(() => randomProgram(robots[activeIdx]?.items));
  const clearActive = () => editActive(() => emptyProg());

  const resolve = async () => {
    const ready = programs.every((p, i) => robots[i].eliminated || p.filter(Boolean).length === SLOTS);
    if (!ready) {
      toast.error(t("sandbox.allReady"));
      return;
    }
    const payload = robots.map((r, i) => ({ ...r, program: programs[i] }));
    const { data } = await api.post("/sandbox/resolve", { board_id: boardId, robots: payload });
    setResult(data);
    replay.start(data.frames);
  };

  const newTurn = () => {
    if (!result) return;
    setRobots(result.robots);
    setPrograms(result.robots.map(() => emptyProg()));
    clearReplay();
    setTurn((n) => n + 1);
    setActiveIdx(result.robots.findIndex((r) => !r.eliminated) || 0);
  };

  const winnerName = result?.winner && robots.find((r) => r.id === result.winner)?.name;
  const activeRobot = robots[activeIdx];

  return (
    <div className="rs-machinery min-h-screen lg:h-screen lg:overflow-hidden flex flex-col" style={{ backgroundImage: "linear-gradient(rgba(8,8,10,0.72), rgba(8,8,10,0.86)), url(/assets/machinery.jpg)" }} data-testid="sandbox-page">
      <div className="rs-steel flex flex-wrap items-center gap-1.5 px-2 py-1.5 shrink-0">
        <button data-testid="sandbox-exit" onClick={() => navigate("/home")} className="rs-icon-btn" title={t("nav.home")}><ArrowLeft size={15} /></button>
        <h1 className="font-title text-sm text-zinc-100 flex items-center gap-1.5 uppercase tracking-wider">
          <Swords size={15} className="text-[#ff9a1f]" /> <span className="hidden sm:inline">{t("sandbox.title")}</span>
        </h1>
        <div className="flex items-center gap-1.5 ml-auto min-w-0">
          <select data-testid="board-select" value={boardId} onChange={(e) => setBoardId(e.target.value)} className="rs-select max-w-[150px] sm:max-w-none">
            {boards.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <select data-testid="robots-select" value={numRobots} onChange={(e) => setNumRobots(Number(e.target.value))} className="rs-select">
            {[2, 3, 4].map((n) => (<option key={n} value={n}>{n} {t("sandbox.robots")}</option>))}
          </select>
          <button data-testid="sandbox-reset" onClick={() => startSandbox(boardId, numRobots)} className="rs-icon-btn" title={t("sandbox.reset")}><RefreshCw size={15} /></button>
          <a href={`mailto:${CONTACT_EMAIL}`} data-testid="game-contact" className="rs-icon-btn" title={t("nav.contact")}><Mail size={15} /></a>
          <button data-testid="lang-toggle-game" onClick={toggleLang} className="rs-icon-btn font-title text-[11px] w-8">{lang.toUpperCase()}</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 p-2">
        <BoardShell
          status={phaseText(t, curFrame, t("game.programming"))}
          right={`${t("game.turn")}: ${turn}`}
          footer={!locked ? (
            <button data-testid="resolve-btn" onClick={resolve} className="rs-go-btn">
              <Play size={13} className="fill-current" /> {t("sandbox.resolve")}
            </button>
          ) : (
            <>
              <PlaybackControls replay={replay} />
              <button data-testid="new-turn-btn" onClick={newTurn} className="rs-go-btn rs-go-purple">
                <RefreshCw size={13} /> {t("sandbox.newTurn")}
              </button>
            </>
          )}
        >
          {board && <GameCanvas board={board} robots={display} beams={beams} events={curFrame?.events} activeId={activeRobot?.id} taken={taken} />}
        </BoardShell>

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
          <EventLog frame={curFrame} className="lg:flex-1 lg:min-h-[110px]" />
        </div>
      </div>
    </div>
  );
}

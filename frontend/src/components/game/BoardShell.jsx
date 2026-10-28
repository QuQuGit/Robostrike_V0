import React from "react";
import { Play, Pause, SkipBack, SkipForward, Gauge } from "lucide-react";
import { useI18n } from "../../i18n";

export function BoardShell({ status, right, children, footer }) {
  return (
    <div className="lg:flex-1 min-w-0 rs-steel rs-bolts rounded-xl px-1.5 sm:px-2.5 pb-1.5 flex flex-col" data-testid="board-shell">
      <div className="flex justify-center">
        <div className="rs-title-plate" data-testid="board-title">ROBOSTRIKE</div>
      </div>
      <div className="rs-screen rounded-md flex items-center justify-between px-2.5 py-1 my-1.5 font-title text-[10px] sm:text-xs uppercase tracking-[0.16em]">
        <span className="text-zinc-100 truncate" data-testid="phase-label">{status}</span>
        <span className="text-zinc-100 shrink-0 ml-2" data-testid="turn-label">{right}</span>
      </div>
      <div className="flex-1 min-h-0 flex items-center">{children}</div>
      <div className="flex justify-center mt-1.5">
        <div className="rs-screen rounded-md flex items-center gap-1.5 px-1.5 py-1 flex-wrap justify-center">{footer}</div>
      </div>
    </div>
  );
}

export function PlaybackControls({ replay }) {
  const { t } = useI18n();
  const { frames, frameIdx, setFrameIdx, playing, setPlaying, speed, cycleSpeed } = replay;
  return (
    <>
      <button data-testid="step-prev" onClick={() => { setPlaying(false); setFrameIdx((i) => Math.max(0, i - 1)); }} className="rs-icon-btn"><SkipBack size={14} /></button>
      <button data-testid="step-play" onClick={() => setPlaying((p) => !p)} className="rs-icon-btn">
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button data-testid="step-next" onClick={() => { setPlaying(false); setFrameIdx((i) => Math.min(frames.length - 1, i + 1)); }} className="rs-icon-btn"><SkipForward size={14} /></button>
      <button data-testid="speed-btn" onClick={cycleSpeed} className="rs-icon-btn font-mono-rs text-[11px] px-2 flex items-center gap-1" title={t("sandbox.speed")}>
        <Gauge size={14} /> ×{speed}
      </button>
      <span className="font-mono-rs text-[11px] text-zinc-300 px-1" data-testid="frame-label">{t("sandbox.frame", { i: frameIdx + 1, n: frames.length })}</span>
    </>
  );
}

export function phaseText(t, frame, idle) {
  return frame ? `${t("game.resolving")} · S${frame.slot + 1} · ${t(`phase.${frame.phase}`)}` : idle;
}

export function EventLog({ frame, className = "" }) {
  const { t } = useI18n();
  return (
    <div className={`rs-steel rounded-md p-2 flex flex-col ${className}`} data-testid="event-log">
      <h3 className="font-title text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-1">{t("sandbox.log")}</h3>
      <div className="rs-screen rounded p-1.5 space-y-0.5 max-h-40 lg:max-h-none lg:flex-1 overflow-y-auto font-mono-rs text-[11px] min-h-[2.5rem]">
        {(!frame || frame.events.length === 0) && <p className="text-zinc-600">—</p>}
        {frame && frame.events.map((e, i) => {
          const vars = { ...e };
          if (e.weapon) vars.weapon = t(`act.${e.weapon}`);
          if (e.item) vars.item = t(`item.${e.item}`);
          return <p key={i} className="text-zinc-300"><span className="text-[#c14dff]">›</span> {t(`ev.${e.t}`, vars)}</p>;
        })}
      </div>
    </div>
  );
}

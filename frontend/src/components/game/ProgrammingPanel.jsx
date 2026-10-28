import React, { useRef } from "react";
import { ACTIONS, CAT_COLORS, CAT_ICON, slotNeon } from "./cards";
import { useI18n } from "../../i18n";
import { ChevronLeft, ChevronRight, Shuffle, Eraser } from "lucide-react";

function ActionCard({ a, disabled, onClick, t }) {
  const Icon = a.icon, Cat = CAT_ICON[a.cat], col = CAT_COLORS[a.cat];
  return (
    <button
      data-testid={`card-${a.id}`}
      disabled={disabled}
      onClick={onClick}
      className="rs-card snap-start shrink-0"
      style={{ "--c": col }}
    >
      <span className="rs-card-head" style={{ color: col }}>{t(`act.${a.id}`)}</span>
      <span className="rs-card-body">
        <Icon size={30} strokeWidth={2.4} style={{ color: `color-mix(in srgb, ${col} 65%, #fff)`, filter: `drop-shadow(0 0 7px ${col})` }} />
      </span>
      <span className="rs-card-foot"><Cat size={10} /></span>
    </button>
  );
}

function Slot({ i, act, disabled, onRemove, t }) {
  const def = act ? ACTIONS.find((a) => a.id === act) : null;
  const Icon = def?.icon;
  const neon = def ? slotNeon(def.cat) : null;
  return (
    <button
      data-testid={`slot-${i}`}
      onClick={() => !disabled && act && onRemove(i)}
      disabled={disabled}
      title={act ? t(`act.${act}`) : ""}
      className={`rs-slot ${act ? "rs-slot-on" : ""}`}
      style={neon ? { "--n": neon } : undefined}
    >
      <span className="rs-slot-num">{i + 1}</span>
      {Icon && <Icon className="rs-slot-icon" strokeWidth={2.4} style={{ color: neon }} />}
    </button>
  );
}

export default function ProgrammingPanel({ program, onAdd, onRemove, onRandom, onClear, disabled, robot }) {
  const { t } = useI18n();
  const trayRef = useRef(null);
  const filled = program.filter(Boolean).length;
  const scroll = (d) => trayRef.current?.scrollBy({ left: d * 220, behavior: "smooth" });

  return (
    <div className="rs-steel rs-bolts rounded-lg p-2.5 sm:p-3 space-y-2.5" data-testid="programming-panel">
      <div className="flex items-center justify-between px-1">
        <span className="font-title text-xs sm:text-sm uppercase tracking-[0.18em] text-zinc-200 flex items-center gap-2">
          {robot && <span className="w-2.5 h-2.5 rounded-full" style={{ background: robot.color, boxShadow: `0 0 8px ${robot.color}` }} />}
          {t("sandbox.hand")}
        </span>
        <div className="flex gap-1.5">
          <button data-testid="program-random" disabled={disabled} onClick={onRandom} className="rs-mini-btn">
            <Shuffle size={12} /> {t("sandbox.random")}
          </button>
          <button data-testid="program-clear" disabled={disabled} onClick={onClear} className="rs-mini-btn">
            <Eraser size={12} /> {t("sandbox.clear")}
          </button>
        </div>
      </div>

      {/* card tray */}
      <div className="rs-screen rounded-md flex items-stretch gap-1 p-1.5">
        <button data-testid="tray-left" onClick={() => scroll(-1)} className="rs-tray-arrow"><ChevronLeft size={18} /></button>
        <div ref={trayRef} className="flex-1 min-w-0 flex gap-2 overflow-x-auto snap-x rs-tray py-1" data-testid="card-tray">
          {ACTIONS.map((a) => (
            <ActionCard key={a.id} a={a} t={t} disabled={disabled || filled >= 6} onClick={() => onAdd(a.id)} />
          ))}
        </div>
        <button data-testid="tray-right" onClick={() => scroll(1)} className="rs-tray-arrow"><ChevronRight size={18} /></button>
      </div>

      {/* 6 program slots */}
      <div className="rs-screen rounded-md p-2 sm:p-2.5">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="font-title text-[10px] uppercase tracking-[0.2em] text-zinc-400">{t("sandbox.slots")}</span>
          <span className="font-mono-rs text-[10px] text-zinc-400" data-testid="slots-count">{filled}/6</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5">
          {program.map((act, i) => (
            <Slot key={i} i={i} act={act} disabled={disabled} onRemove={onRemove} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

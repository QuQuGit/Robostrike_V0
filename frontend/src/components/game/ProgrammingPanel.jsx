import React, { useRef } from "react";
import { ACTIONS, ACTION_MAP, CAT_COLORS, CAT_ICON, slotNeon, allowedAfter, boostMultipliers } from "./cards";
import { useI18n } from "../../i18n";
import { ChevronLeft, ChevronRight, Shuffle, Eraser } from "lucide-react";

function CardIcon({ a, size, color, glow }) {
  const Icon = a.icon;
  const style = { color, filter: `drop-shadow(0 0 6px ${glow})` };
  if (a.double)
    return (
      <span className="flex -space-x-2.5" style={style}>
        <Icon size={size * 0.8} strokeWidth={2.4} /><Icon size={size * 0.8} strokeWidth={2.4} />
      </span>
    );
  return <Icon size={size} strokeWidth={2.4} style={style} />;
}

function ActionCard({ a, disabled, onClick, t, count }) {
  const Cat = CAT_ICON[a.cat], col = CAT_COLORS[a.cat];
  return (
    <button data-testid={`card-${a.id}`} disabled={disabled} onClick={onClick}
      className={`rs-card snap-start shrink-0 ${a.item ? "rs-card-item" : ""}`} style={{ "--c": col }}>
      <span className="rs-card-head">{t(`act.${a.id}`)}</span>
      <span className="rs-card-body">
        <CardIcon a={a} size={24} color={`color-mix(in srgb, ${col} 65%, #fff)`} glow={col} />
      </span>
      <span className="rs-card-foot"><Cat size={9} /></span>
      {a.item && <span className="rs-card-count" data-testid={`card-count-${a.id}`}>{count}</span>}
    </button>
  );
}

function Slot({ i, act, mult, disabled, onRemove, t }) {
  const def = act ? ACTION_MAP[act] : null;
  const neon = def ? slotNeon(def.cat) : null;
  return (
    <button data-testid={`slot-${i}`} onClick={() => !disabled && act && onRemove(i)} disabled={disabled}
      title={act ? t(`act.${act}`) : ""} className={`rs-slot ${act ? "rs-slot-on" : ""}`}
      style={neon ? { "--n": neon } : undefined}>
      <span className="rs-slot-num">{i + 1}</span>
      {def && <CardIcon a={def} size={26} color={neon} glow={neon} />}
      {mult > 1 && <span className="rs-slot-mult" data-testid={`slot-mult-${i}`}>×{mult}</span>}
    </button>
  );
}

export default function ProgrammingPanel({ program, onAdd, onRemove, onRandom, onClear, disabled, robot }) {
  const { t } = useI18n();
  const trayRef = useRef(null);
  const filled = program.filter(Boolean).length;
  const k = program.findIndex((s) => s === null);
  const prev = k > 0 ? program[k - 1] : null;
  const next = k >= 0 && k < 5 ? program[k + 1] : null;
  const mult = boostMultipliers(program);
  const remaining = (id) => (robot?.items || []).filter((x) => x === id).length - program.filter((x) => x === id).length;
  const scroll = (d) => trayRef.current?.scrollBy({ left: d * 200, behavior: "smooth" });

  const canPlay = (a) =>
    k !== -1 && allowedAfter(prev, a.id) && !(a.id === "turbo" && next && !allowedAfter("turbo", next)) &&
    (!a.item || remaining(a.id) > 0);

  return (
    <div className="rs-steel rs-bolts rounded-lg p-2 space-y-2" data-testid="programming-panel">
      <div className="flex items-center justify-between px-1">
        <span className="font-title text-[11px] uppercase tracking-[0.16em] text-zinc-200 flex items-center gap-2">
          {robot && <span className="w-2 h-2 rounded-full" style={{ background: robot.color, boxShadow: `0 0 8px ${robot.color}` }} />}
          {t("sandbox.hand")}
        </span>
        <div className="flex gap-1">
          <button data-testid="program-random" disabled={disabled} onClick={onRandom} className="rs-mini-btn"><Shuffle size={11} /> {t("sandbox.random")}</button>
          <button data-testid="program-clear" disabled={disabled} onClick={onClear} className="rs-mini-btn"><Eraser size={11} /> {t("sandbox.clear")}</button>
        </div>
      </div>

      <div className="rs-screen rounded-md flex items-stretch gap-1 p-1">
        <button data-testid="tray-left" onClick={() => scroll(-1)} className="rs-tray-arrow lg:hidden"><ChevronLeft size={16} /></button>
        <div ref={trayRef} className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto lg:overflow-visible lg:flex-wrap snap-x rs-tray py-1" data-testid="card-tray">
          {ACTIONS.map((a, idx) => (
            <React.Fragment key={a.id}>
              {a.item && !ACTIONS[idx - 1].item && <span className="rs-tray-sep" />}
              <ActionCard a={a} t={t} count={a.item ? Math.max(0, remaining(a.id)) : null}
                disabled={disabled || !canPlay(a)} onClick={() => onAdd(a.id)} />
            </React.Fragment>
          ))}
        </div>
        <button data-testid="tray-right" onClick={() => scroll(1)} className="rs-tray-arrow lg:hidden"><ChevronRight size={16} /></button>
      </div>

      <div className="rs-screen rounded-md p-1.5">
        <div className="flex items-center justify-between mb-1 px-0.5">
          <span className="font-title text-[10px] uppercase tracking-[0.18em] text-zinc-400">{t("sandbox.slots")}</span>
          <span className="font-mono-rs text-[10px] text-zinc-400" data-testid="slots-count">{filled}/6</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {program.map((act, i) => (
            <Slot key={i} i={i} act={act} mult={mult[i]} disabled={disabled} onRemove={onRemove} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

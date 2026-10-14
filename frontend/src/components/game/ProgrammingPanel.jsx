import React from "react";
import { ACTIONS, CAT_COLORS } from "./cards";
import { useI18n } from "../../i18n";
import { X, Shuffle, Eraser } from "lucide-react";

export default function ProgrammingPanel({
  program, onAdd, onRemove, onRandom, onClear, disabled,
}) {
  const { t } = useI18n();
  const filled = program.filter(Boolean).length;

  return (
    <div className="rs-panel p-4 rounded-sm" data-testid="programming-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm uppercase tracking-[0.2em] text-[#f97316]">
          {t("sandbox.slots")}
        </h3>
        <span className="font-mono-rs text-xs text-muted-foreground">{filled}/6</span>
      </div>

      {/* 6 slots */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        {program.map((act, i) => {
          const def = act ? ACTIONS.find((a) => a.id === act) : null;
          const Icon = def?.icon;
          return (
            <button
              key={i}
              data-testid={`slot-${i}`}
              onClick={() => !disabled && act && onRemove(i)}
              disabled={disabled}
              className="aspect-square rounded-sm flex flex-col items-center justify-center text-[10px] relative transition-colors"
              style={{
                border: act ? `1px solid ${CAT_COLORS[def.cat]}` : "1px dashed rgba(255,255,255,0.18)",
                background: act ? "rgba(255,255,255,0.03)" : "transparent",
              }}
            >
              <span className="absolute top-0.5 left-1 font-mono-rs text-[9px] text-muted-foreground">
                {i + 1}
              </span>
              {Icon && <Icon size={18} style={{ color: CAT_COLORS[def.cat] }} />}
              {act && (
                <span className="font-mono-rs mt-0.5 leading-none text-[8px] text-muted-foreground truncate w-full px-0.5 text-center">
                  {t(`act.${act}`)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* action palette */}
      <h4 className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
        {t("sandbox.hand")}
      </h4>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              data-testid={`card-${a.id}`}
              disabled={disabled || filled >= 6}
              onClick={() => onAdd(a.id)}
              className="rs-panel rounded-sm py-2 flex flex-col items-center gap-1 hover:-translate-y-0.5 transition-transform disabled:opacity-40 disabled:translate-y-0"
              style={{ borderColor: `${CAT_COLORS[a.cat]}55` }}
            >
              <Icon size={18} style={{ color: CAT_COLORS[a.cat] }} />
              <span className="font-mono-rs text-[8px] text-muted-foreground leading-none text-center">
                {t(`act.${a.id}`)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          data-testid="program-random"
          disabled={disabled}
          onClick={onRandom}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm border border-[#8b5cf6] text-[#8b5cf6] text-xs uppercase tracking-wider hover:bg-[#8b5cf6]/10 disabled:opacity-40"
        >
          <Shuffle size={13} /> {t("sandbox.random")}
        </button>
        <button
          data-testid="program-clear"
          disabled={disabled}
          onClick={onClear}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm border border-border text-muted-foreground text-xs uppercase tracking-wider hover:text-white disabled:opacity-40"
        >
          <Eraser size={13} /> {t("sandbox.clear")}
        </button>
      </div>
    </div>
  );
}

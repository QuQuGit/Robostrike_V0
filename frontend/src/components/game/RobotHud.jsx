import React from "react";
import { useI18n } from "../../i18n";
import { Heart, Shield, Zap } from "lucide-react";

export default function RobotHud({ robots, programs, activeIdx, onSelect }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2" data-testid="robot-hud">
      {robots.map((r, i) => {
        const prog = programs[i] || [];
        const count = prog.filter(Boolean).length;
        const active = i === activeIdx;
        return (
          <button
            key={r.id}
            data-testid={`robot-tab-${i}`}
            onClick={() => onSelect(i)}
            className="w-full text-left rounded-sm p-3 transition-colors"
            style={{
              background: active ? "rgba(255,255,255,0.04)" : "#131316",
              border: `1px solid ${active ? r.color : "rgba(255,255,255,0.08)"}`,
              boxShadow: active ? `0 0 14px ${r.color}44` : "none",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-sm"
                  style={{ background: r.color }}
                />
                <span className="font-display text-sm">{r.name}</span>
                {r.invuln && <Shield size={13} className="text-sky-400" />}
                {r.eliminated && (
                  <span className="font-mono-rs text-[10px] text-red-500">OUT</span>
                )}
              </div>
              <span className="font-mono-rs text-[10px] text-muted-foreground">
                {count}/6
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* hp blocks */}
              <div className="flex gap-0.5">
                {Array.from({ length: r.max_hp }).map((_, k) => (
                  <span
                    key={k}
                    className="w-2.5 h-3 rounded-[1px]"
                    style={{ background: k < r.hp ? r.color : "rgba(255,255,255,0.12)" }}
                  />
                ))}
              </div>
              {/* lives */}
              <div className="flex items-center gap-0.5 ml-auto">
                {Array.from({ length: 3 }).map((_, k) => (
                  <Heart
                    key={k}
                    size={12}
                    className={k < r.lives ? "fill-red-500 text-red-500" : "text-muted-foreground"}
                  />
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

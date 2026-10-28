import React from "react";
import { Heart, Shield } from "lucide-react";

const THUMB = {
  "#ef4444": ["robot_red.png", ""], "#3b82f6": ["robot_blue.png", ""],
  "#10b981": ["robot_green.png", ""], "#eab308": ["robot_yellow.png", ""],
  "#a855f7": ["robot_blue.png", "hue-rotate(60deg)"], "#ec4899": ["robot_red.png", "hue-rotate(-35deg)"],
};

function HpBar({ hp, max }) {
  return (
    <div className="flex items-center gap-1.5 rs-screen rounded px-1.5 py-1 flex-1 min-w-0">
      <Heart size={13} className="fill-[#ff9a1f] text-[#ff9a1f] shrink-0" />
      <div className="flex gap-[3px] flex-1">
        {Array.from({ length: max }).map((_, k) => (
          <span key={k} className={`rs-hp-seg ${k < hp ? (hp <= 2 ? "rs-hp-low" : "rs-hp-on") : ""}`} />
        ))}
      </div>
    </div>
  );
}

export default function RobotHud({ robots, programs, activeIdx, onSelect }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2" data-testid="robot-hud">
      {robots.map((r, i) => {
        const count = (programs[i] || []).filter(Boolean).length;
        const active = i === activeIdx;
        const [img, filter] = THUMB[r.color] || THUMB["#ef4444"];
        return (
          <button
            key={r.id}
            data-testid={`robot-tab-${i}`}
            onClick={() => onSelect(i)}
            className={`rs-steel rounded-md p-2 text-left flex items-center gap-2.5 transition-transform hover:-translate-y-0.5 ${r.eliminated ? "opacity-40" : ""}`}
            style={active ? { borderColor: r.color, boxShadow: `0 0 0 1px ${r.color}, 0 0 18px ${r.color}66` } : undefined}
          >
            <div className="rs-screen rounded w-11 h-11 sm:w-12 sm:h-12 shrink-0 grid place-items-center">
              <img src={`/assets/${img}`} alt="" className="w-9 h-9 sm:w-10 sm:h-10 transition-transform duration-300"
                style={{ transform: `rotate(${r.dir * 90}deg)`, filter: filter || undefined }} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="font-title text-sm" style={{ color: r.color }}>{r.name}</span>
                {r.invuln && <Shield size={12} className="text-sky-400" />}
                {r.eliminated && <span className="font-mono-rs text-[10px] text-red-500">OUT</span>}
                <span className="ml-auto flex gap-0.5" data-testid={`robot-lives-${i}`}>
                  {Array.from({ length: 3 }).map((_, k) => (
                    <Heart key={k} size={10} className={k < r.lives ? "fill-red-500 text-red-500" : "text-zinc-600"} />
                  ))}
                </span>
              </div>
              <HpBar hp={r.hp} max={r.max_hp} />
              <div className="flex gap-[3px]" data-testid={`robot-prog-${i}`}>
                {Array.from({ length: 6 }).map((_, k) => (
                  <span key={k} className="h-1 flex-1 rounded-full" style={{ background: k < count ? r.color : "rgba(255,255,255,0.1)" }} />
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

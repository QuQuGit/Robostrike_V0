import {
  ArrowUp, ArrowDown, RotateCcw, RotateCw, ChevronsUp, Shield, Zap, Bomb,
  Move, Undo2, Flame, Heart,
} from "lucide-react";
import { BlastIcon } from "./icons";

export const ACTIONS = [
  { id: "forward", icon: ArrowUp, cat: "move" },
  { id: "backward", icon: ArrowDown, cat: "move" },
  { id: "turbo", icon: ChevronsUp, cat: "move" },
  { id: "left", icon: RotateCcw, cat: "turn" },
  { id: "right", icon: RotateCw, cat: "turn" },
  { id: "laser", icon: Zap, cat: "atk" },
  { id: "blast", icon: BlastIcon, cat: "atk" },
  { id: "double_laser", icon: Zap, cat: "atk", item: true, double: true },
  { id: "bomb", icon: Bomb, cat: "atk", item: true },
  { id: "shield", icon: Shield, cat: "def", item: true },
];
export const ACTION_MAP = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
export const DEFAULT_ACTIONS = ACTIONS.filter((a) => !a.item);
export const ITEM_ACTIONS = ACTIONS.filter((a) => a.item);
export const PICKUP_ICON = { bomb: Bomb, double_laser: Zap, shield: Shield, life: Heart };

const MOVES = new Set(["forward", "backward", "left", "right"]);
// after a boost only movements (or another boost) can be played
export const allowedAfter = (prev, id) => prev !== "turbo" || MOVES.has(id) || id === "turbo";

export const CAT_COLORS = { move: "#38a8ff", turn: "#b05cff", atk: "#ff6a1f", def: "#8f6bff" };
export const CAT_ICON = { move: Move, turn: Undo2, atk: Flame, def: Shield };
export const slotNeon = (cat) => (cat === "atk" ? "#ff9a1f" : "#c14dff");

// multiplier (cells moved) for each slot, given boost chains
export function boostMultipliers(program) {
  let b = 0;
  return program.map((a) => {
    if (a === "turbo") { b += 1; return 0; }
    const m = MOVES.has(a) ? 1 + b : 0;
    b = 0;
    return m;
  });
}

const VEC = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };

// Approximate path ignoring walls/pushes/conveyors, used only for the on-board preview.
export function previewPath({ x, y, dir, program, width, height }) {
  const pts = [{ x, y, dir }];
  const mult = boostMultipliers(program || []);
  const step = (d, n) => {
    for (let k = 0; k < n; k++) {
      const nx = x + VEC[d][0], ny = y + VEC[d][1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      x = nx; y = ny;
      pts.push({ x, y, dir });
    }
  };
  (program || []).forEach((a, i) => {
    const n = mult[i];
    if ((a === "left" || a === "right") && n === 1) dir = (dir + (a === "left" ? 3 : 1)) % 4;
    else if (a === "left") step((dir + 3) % 4, n);
    else if (a === "right") step((dir + 1) % 4, n);
    else if (a === "forward") step(dir, n);
    else if (a === "backward") step((dir + 2) % 4, n);
    pts[pts.length - 1].dir = dir;
  });
  return pts;
}

export function randomProgram(items) {
  const stock = [...(items || [])];
  const prog = [];
  for (let i = 0; i < 6; i++) {
    const prev = prog[i - 1];
    const pool = ACTIONS.filter((a) => allowedAfter(prev, a.id) && (!a.item || stock.includes(a.id)) && !(i === 5 && a.id === "turbo"));
    const pick = pool[Math.floor(Math.random() * pool.length)].id;
    if (ACTION_MAP[pick].item) stock.splice(stock.indexOf(pick), 1);
    prog.push(pick);
  }
  return prog;
}

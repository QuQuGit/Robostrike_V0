import {
  ArrowUp, ArrowDown, RotateCcw, RotateCw, RefreshCw,
  ChevronsUp, Shield, Zap, Crosshair, Radiation, Bomb,
  Move, Undo2, Flame,
} from "lucide-react";

export const ACTIONS = [
  { id: "forward", icon: ArrowUp, cat: "move" },
  { id: "backward", icon: ArrowDown, cat: "move" },
  { id: "turbo", icon: ChevronsUp, cat: "move" },
  { id: "left", icon: RotateCcw, cat: "turn" },
  { id: "right", icon: RotateCw, cat: "turn" },
  { id: "uturn", icon: RefreshCw, cat: "turn" },
  { id: "laser", icon: Zap, cat: "atk" },
  { id: "double_laser", icon: Crosshair, cat: "atk" },
  { id: "blast", icon: Radiation, cat: "atk" },
  { id: "bomb", icon: Bomb, cat: "atk" },
  { id: "shield", icon: Shield, cat: "def" },
];

export const ACTION_MAP = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

// card face colors (mockup: Move blue, Turn purple, Fire orange-red, Shield violet)
export const CAT_COLORS = {
  move: "#38a8ff",
  turn: "#b05cff",
  atk: "#ff6a1f",
  def: "#8f6bff",
};
export const CAT_ICON = { move: Move, turn: Undo2, atk: Flame, def: Shield };
// programmed slot neon: purple for movement/defence, orange for weapons
export const slotNeon = (cat) => (cat === "atk" ? "#ff9a1f" : "#c14dff");

const VEC = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };

// Approximate path ignoring walls/pushes/conveyors, used only for the on-board preview.
export function previewPath({ x, y, dir, program, width, height }) {
  const pts = [{ x, y, dir }];
  const step = (d) => {
    const nx = x + VEC[d][0], ny = y + VEC[d][1];
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
    x = nx; y = ny;
    pts.push({ x, y, dir });
  };
  (program || []).forEach((a) => {
    if (a === "left") dir = (dir + 3) % 4;
    else if (a === "right") dir = (dir + 1) % 4;
    else if (a === "uturn") dir = (dir + 2) % 4;
    else if (a === "forward") step(dir);
    else if (a === "backward") step((dir + 2) % 4);
    else if (a === "turbo") { step(dir); step(dir); }
    pts[pts.length - 1].dir = dir;
  });
  return pts;
}

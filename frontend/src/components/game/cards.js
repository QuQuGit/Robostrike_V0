import {
  ArrowUp, ArrowDown, RotateCcw, RotateCw, RefreshCw,
  ChevronsUp, Shield, Target, Crosshair, Radio, Bomb,
} from "lucide-react";

export const ACTIONS = [
  { id: "forward", icon: ArrowUp, cat: "move" },
  { id: "backward", icon: ArrowDown, cat: "move" },
  { id: "left", icon: RotateCcw, cat: "turn" },
  { id: "right", icon: RotateCw, cat: "turn" },
  { id: "uturn", icon: RefreshCw, cat: "turn" },
  { id: "turbo", icon: ChevronsUp, cat: "move" },
  { id: "shield", icon: Shield, cat: "def" },
  { id: "laser", icon: Target, cat: "atk" },
  { id: "double_laser", icon: Crosshair, cat: "atk" },
  { id: "blast", icon: Radio, cat: "atk" },
  { id: "bomb", icon: Bomb, cat: "atk" },
];

export const ACTION_MAP = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

export const CAT_COLORS = {
  move: "#e5e7eb",
  turn: "#60a5fa",
  def: "#8b5cf6",
  atk: "#f97316",
};

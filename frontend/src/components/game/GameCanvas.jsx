import React, { useEffect, useRef, useState } from "react";
import { previewPath } from "./cards";
import { useI18n } from "../../i18n";

/* ---------- helpers ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function rgba(hex, a) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}
const hashCell = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 100;
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const VEC = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };
const ROT = { 0: 0, 1: Math.PI / 2, 2: Math.PI, 3: -Math.PI / 2 };
const LIFE = 620;

/* ---------- sprites ---------- */
const IMG = {};
function sprite(name) {
  if (!IMG[name]) {
    const im = new Image();
    im.src = `/assets/${name}`;
    IMG[name] = im;
  }
  const im = IMG[name];
  return im.complete && im.naturalWidth ? im : null;
}
const ROBOT_SPRITE = {
  "#ef4444": ["robot_red.png", null], "#3b82f6": ["robot_blue.png", null],
  "#10b981": ["robot_green.png", null], "#eab308": ["robot_yellow.png", null],
  "#a855f7": ["robot_blue.png", "hue-rotate(60deg)"], "#ec4899": ["robot_red.png", "hue-rotate(-35deg)"],
};
["floor.jpg", "pit.jpg", ...Object.values(ROBOT_SPRITE).map((s) => s[0])].forEach(sprite);

export default function GameCanvas({ board, robots, beams, plans = [], activeId, taken = [], events }) {
  const { t } = useI18n();
  const canvasRef = useRef(null);
  const popRef = useRef([]);
  const prevRobotsRef = useRef(robots);
  const wrapRef = useRef(null);
  const dispRef = useRef({});
  const fxRef = useRef({ t0: 0, list: [] });
  const staticRef = useRef({ key: "", cv: null });
  const [availW, setAvailW] = useState(0);
  const dataRef = useRef({});
  dataRef.current = { board, robots, plans, activeId, availW, taken };

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setAvailW(Math.floor(e.contentRect.width)));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const list = (beams || []).map((b) => ({
      ...b,
      parts: b.type === "bomb" || b.type === "blast" || b.type === "explode"
        ? Array.from({ length: 18 }, () => ({ ang: Math.random() * 6.283, spd: 0.5 + Math.random(), sz: 1.5 + Math.random() * 2.5 }))
        : null,
    }));
    const recoil = Object.fromEntries(list.filter((b) => b.by).map((b) => [b.by, b.type]));
    fxRef.current = { t0: performance.now(), list, recoil };
  }, [beams]);

  // floating "+1 Bombe" / "+5 PV" / "-3 PV" popups
  useEffect(() => {
    const prev = prevRobotsRef.current || [];
    prevRobotsRef.current = robots;
    const now = performance.now();
    (events || []).forEach((e) => {
      const r = robots.find((x) => x.name === e.robot);
      if (!r) return;
      let text, color;
      if (e.t === "pickup" && e.item === "life") {
        const before = prev.find((x) => x.id === r.id)?.hp ?? 0;
        text = `+${Math.max(0, r.max_hp - before)} ${t("game.hp")}`; color = "#4ade80";
      } else if (e.t === "pickup") {
        text = `+1 ${t(`item.${e.item}`)}`; color = "#ffb347";
      } else if (e.t === "penalty") {
        text = `-${e.dmg} ${t("game.hp")}`; color = "#f87171";
      } else return;
      popRef.current.push({ id: r.id, x: r.x, y: r.y, text, color, t0: now });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useEffect(() => {
    let raf;
    const ctx = canvasRef.current.getContext("2d");
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const { board, robots, plans, activeId, availW, taken } = dataRef.current;
      const canvas = canvasRef.current;
      if (!board || !canvas || !availW) return;
      const maxH = window.innerWidth >= 1024 ? window.innerHeight - 190 : window.innerHeight * 0.44;
      const cell = Math.max(18, Math.floor(Math.min(availW / (board.width + 1.1), maxH / (board.height + 1.1), 84)));
      const FR = Math.round(cell * 0.55);
      const W = cell * board.width + FR * 2, H = cell * board.height + FR * 2;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(getStatic(staticRef, board, cell, FR, W, H, dpr), 0, 0, W, H);
      drawNeon(ctx, W, H, FR, now);

      ctx.save();
      ctx.translate(FR, FR);
      drawConveyors(ctx, board, cell, now);
      drawRotators(ctx, board, cell, now);
      drawPickups(ctx, board, cell, now, taken);
      drawBoardLasers(ctx, board, robots, cell, now);
      drawWalls(ctx, board, cell);
      plans.forEach((p) => drawPlan(ctx, p, cell, now, p.id === activeId));
      robots.forEach((r) => drawRobot(ctx, r, dispRef.current, cell, now, r.id === activeId, fxRef.current));
      drawEffects(ctx, fxRef.current, cell, now);
      popRef.current = popRef.current.filter((p) => now - p.t0 < 1500);
      popRef.current.forEach((p) => drawPopup(ctx, p, dispRef.current[p.id], cell, now));
      ctx.restore();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="w-full min-w-0 flex justify-center" data-testid="game-canvas-wrap">
      <canvas ref={canvasRef} className="block max-w-full" data-testid="game-canvas" />
    </div>
  );
}

/* ---------- static layer (frame, floor, pits) cached offscreen ---------- */
function getStatic(ref, board, cell, FR, W, H, dpr) {
  const loaded = ["floor.jpg", "pit.jpg"].filter(sprite).length;
  const key = `${board.id}|${cell}|${dpr}|${loaded}`;
  if (ref.current.key === key) return ref.current.cv;
  const cv = document.createElement("canvas");
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFrame(c, W, H, FR);
  c.save();
  c.translate(FR, FR);
  drawFloor(c, board, cell);
  c.restore();
  ref.current = { key, cv };
  return cv;
}

function drawFrame(ctx, W, H, FR) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#55585e"); g.addColorStop(0.5, "#34363b"); g.addColorStop(1, "#202125");
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, W, H, FR * 0.35); ctx.fill();
  ctx.strokeStyle = "#0b0b0d"; ctx.lineWidth = 2; ctx.stroke();
  // tubular pipe running around the frame
  const pw = FR * 0.42, o = FR * 0.5;
  [[o, o, W - o, o], [o, H - o, W - o, H - o]].forEach(([x1, y1, x2, y2]) => {
    const pg = ctx.createLinearGradient(0, y1 - pw / 2, 0, y1 + pw / 2);
    pg.addColorStop(0, "#2a2b2f"); pg.addColorStop(0.35, "#8d9096"); pg.addColorStop(0.6, "#5d6066"); pg.addColorStop(1, "#1f2023");
    ctx.strokeStyle = pg; ctx.lineWidth = pw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
  // pipe collars + bolts
  const collar = (x, y, vertical) => {
    ctx.fillStyle = "#6e7177"; ctx.strokeStyle = "#121214"; ctx.lineWidth = 1.5;
    const a = vertical ? pw * 1.5 : pw * 0.7, b = vertical ? pw * 0.7 : pw * 1.5;
    roundRect(ctx, x - a / 2, y - b / 2, a, b, 2); ctx.fill(); ctx.stroke();
  };
  for (let x = FR * 2; x < W - FR * 1.5; x += FR * 4) { collar(x, o, false); collar(x, H - o, false); }
  const bolt = (x, y, r) => {
    const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    bg.addColorStop(0, "#c9ccd2"); bg.addColorStop(1, "#3a3c41");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.stroke();
  };
  [[o, o], [W - o, o], [o, H - o], [W - o, H - o]].forEach(([x, y]) => {
    ctx.fillStyle = "#45484e"; ctx.strokeStyle = "#0e0e10"; ctx.lineWidth = 2;
    roundRect(ctx, x - FR * 0.42, y - FR * 0.42, FR * 0.84, FR * 0.84, 4); ctx.fill(); ctx.stroke();
    bolt(x, y, FR * 0.16);
  });
  // inner well
  ctx.fillStyle = "#0a0a0b";
  ctx.fillRect(FR - 4, FR - 4, W - 2 * FR + 8, H - 2 * FR + 8);
}

function drawFloor(ctx, board, cell) {
  const floor = sprite("floor.jpg"), pit = sprite("pit.jpg");
  const holes = new Set((board.holes || []).map(([x, y]) => `${x},${y}`));
  for (let x = 0; x < board.width; x++) {
    for (let y = 0; y < board.height; y++) {
      const px = x * cell, py = y * cell, h = hashCell(x, y);
      if (holes.has(`${x},${y}`)) {
        if (pit) ctx.drawImage(pit, px, py, cell, cell);
        else { ctx.fillStyle = "#000"; ctx.fillRect(px, py, cell, cell); }
        continue;
      }
      ctx.save();
      ctx.translate(px + cell / 2, py + cell / 2);
      ctx.rotate((h % 4) * Math.PI / 2);
      if (floor) ctx.drawImage(floor, -cell / 2, -cell / 2, cell, cell);
      else { ctx.fillStyle = "#5a554e"; ctx.fillRect(-cell / 2, -cell / 2, cell, cell); }
      ctx.restore();
      ctx.fillStyle = `rgba(10,8,6,${0.18 + (h % 7) * 0.025})`;
      ctx.fillRect(px, py, cell, cell);
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.65)"; ctx.lineWidth = 1;
  for (let x = 0; x <= board.width; x++) { ctx.beginPath(); ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, board.height * cell); ctx.stroke(); }
  for (let y = 0; y <= board.height; y++) { ctx.beginPath(); ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(board.width * cell, y * cell + 0.5); ctx.stroke(); }
}

/* ---------- neon side tubes (purple left, orange right) ---------- */
function drawNeon(ctx, W, H, FR, now) {
  const fl = 0.75 + 0.25 * Math.sin(now / 160) * Math.sin(now / 47);
  [[FR * 0.5, "#c026d3", "#f0abfc"], [W - FR * 0.5, "#f97316", "#fed7aa"]].forEach(([x, col, core]) => {
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = FR * 0.9 * fl;
    ctx.strokeStyle = rgba(col === "#c026d3" ? "#a21caf" : "#ea580c", 0.9);
    ctx.lineWidth = FR * 0.34;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, FR * 1.1); ctx.lineTo(x, H - FR * 1.1); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(core.startsWith("#f0") ? "#f5d0fe" : "#ffedd5", 0.55 + 0.4 * fl);
    ctx.lineWidth = FR * 0.1;
    ctx.beginPath(); ctx.moveTo(x, FR * 1.1); ctx.lineTo(x, H - FR * 1.1); ctx.stroke();
    ctx.restore();
  });
}

/* ---------- conveyors: full-cell belts with rails & moving slats ---------- */
function convInfo(board, c) {
  const map = board._convMap || (board._convMap = Object.fromEntries((board.conveyors || []).map((k) => [`${k.x},${k.y}`, k])));
  const [dx, dy] = VEC[c.dir];
  const nxt = map[`${c.x + dx},${c.y + dy}`];
  const outOpen = !nxt || (nxt.dir + 2) % 4 === c.dir;
  const ins = [0, 1, 2, 3].filter((s) => {
    const n = map[`${c.x + VEC[s][0]},${c.y + VEC[s][1]}`];
    return n && n.x + VEC[n.dir][0] === c.x && n.y + VEC[n.dir][1] === c.y;
  });
  const back = (c.dir + 2) % 4;
  const inSide = ins.includes(back) ? back : ins.length ? ins[0] : back;
  return { rel: (inSide - c.dir + 4) % 4, inOpen: !ins.length, outOpen };
}
function rail(ctx, x, y, w, h, vertical) {
  const g = vertical ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#2b2d31"); g.addColorStop(0.45, "#a9adb4"); g.addColorStop(1, "#3a3c41");
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function roller(ctx, h, t) {
  const g = ctx.createLinearGradient(0, -h, 0, -h + t);
  g.addColorStop(0, "#56595f"); g.addColorStop(0.5, "#d0d3d8"); g.addColorStop(1, "#45484d");
  ctx.fillStyle = g; ctx.fillRect(-h, -h, h * 2, t);
}
function chevron(ctx, x, y, ang, sz, alpha) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.shadowColor = "#e879f9"; ctx.shadowBlur = sz * 1.4;
  ctx.strokeStyle = rgba("#f5a8ff", alpha); ctx.lineWidth = sz * 0.5; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.75); ctx.lineTo(0, sz * 0.25); ctx.lineTo(sz, -sz * 0.75); ctx.stroke();
  ctx.restore();
}
function drawConveyors(ctx, board, cell, now) {
  const flow = (now / 1100) % 1, h = cell / 2, t = cell * 0.12;
  (board.conveyors || []).forEach((c) => {
    const { rel, inOpen, outOpen } = convInfo(board, c);
    ctx.save();
    ctx.translate(c.x * cell + h, c.y * cell + h);
    ctx.rotate(ROT[c.dir]);
    if (rel === 1) ctx.scale(-1, 1);
    ctx.beginPath(); ctx.rect(-h, -h, cell, cell); ctx.clip();
    // belt rubber
    ctx.fillStyle = "#2a1640"; ctx.fillRect(-h, -h, cell, cell);
    const N = 5;
    if (rel === 2) {
      for (let k = -1; k < N; k++) {
        const y = h - ((k + flow) / N) * cell;
        const sg = ctx.createLinearGradient(0, y - cell / N, 0, y);
        sg.addColorStop(0, "#3d2160"); sg.addColorStop(0.75, "#6a3fa3"); sg.addColorStop(1, "#21102f");
        ctx.fillStyle = sg; ctx.fillRect(-h + t, y - cell / N + 1, cell - 2 * t, cell / N - 1);
      }
      for (let k = 0; k < 2; k++) {
        const f = (flow + k * 0.5) % 1;
        chevron(ctx, 0, h - f * cell, Math.PI, cell * 0.11, Math.sin(f * Math.PI));
      }
      rail(ctx, -h, -h, t, cell, true); rail(ctx, h - t, -h, t, cell, true);
      if (inOpen) rail(ctx, -h, h - t, cell, t, false);
    } else {
      // corner: enters from left edge, exits top edge, around the top-left inner corner
      const cx = -h, cy = -h;
      for (let k = -1; k < N; k++) {
        const a0 = (Math.PI / 2) * (1 - (k + flow) / N), a1 = a0 - (Math.PI / 2) / N;
        const sg = ctx.createLinearGradient(cx + Math.cos(a0) * cell, cy + Math.sin(a0) * cell, cx + Math.cos(a1) * cell, cy + Math.sin(a1) * cell);
        sg.addColorStop(0, "#3d2160"); sg.addColorStop(0.75, "#6a3fa3"); sg.addColorStop(1, "#21102f");
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, cell * 1.5, a1, a0); ctx.closePath(); ctx.fill();
      }
      for (let k = 0; k < 2; k++) {
        const f = (flow + k * 0.5) % 1, a = (Math.PI / 2) * (1 - f), r = cell * 0.5;
        chevron(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, a, cell * 0.11, Math.sin(f * Math.PI));
      }
      rail(ctx, -h, h - t, cell, t, false); rail(ctx, h - t, -h, t, cell, true);
      const pg = ctx.createRadialGradient(cx + 2, cy + 2, 0, cx, cy, t * 1.6);
      pg.addColorStop(0, "#c9ccd2"); pg.addColorStop(1, "#3a3c41");
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, t * 1.6, 0, Math.PI / 2); ctx.lineTo(cx, cy); ctx.fill();
      if (inOpen) rail(ctx, -h, -h, t, cell, true);
    }
    if (outOpen) roller(ctx, h, t * 1.3);
    // bolts on rails
    ctx.fillStyle = "#1f2023";
    [[-h + t / 2, -h * 0.6], [-h + t / 2, h * 0.6], [h - t / 2, -h * 0.6], [h - t / 2, h * 0.6]].forEach(([bx, by]) => {
      if (rel !== 2 && bx < 0) return;
      ctx.beginPath(); ctx.arc(bx, by, t * 0.22, 0, 6.283); ctx.fill();
    });
    ctx.restore();
  });
}

/* ---------- turntables (rotate robot left/right) ---------- */
function drawRotators(ctx, board, cell, now) {
  (board.rotators || []).forEach((rt) => {
    const cx = rt.x * cell + cell / 2, cy = rt.y * cell + cell / 2, R = cell * 0.44;
    const col = rt.rot > 0 ? "#ff9a1f" : "#c14dff";
    ctx.save();
    ctx.translate(cx, cy);
    // gear ring
    ctx.fillStyle = "#26272b";
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 6.283, rr = i % 2 ? R : R * 1.08;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 0, 0, 0, R);
    g.addColorStop(0, "#9da1a8"); g.addColorStop(1, "#3c3e43");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5; ctx.stroke();
    // rotating arrows
    ctx.rotate(rt.rot * now / 900);
    ctx.shadowColor = col; ctx.shadowBlur = cell * 0.25;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = cell * 0.07; ctx.lineCap = "round";
    [0, Math.PI].forEach((o) => {
      ctx.beginPath(); ctx.arc(0, 0, R * 0.58, o + 0.25, o + 2.4); ctx.stroke();
      const ea = rt.rot > 0 ? o + 2.4 : o + 0.25, sgn = rt.rot > 0 ? 1 : -1;
      const ex = Math.cos(ea) * R * 0.58, ey = Math.sin(ea) * R * 0.58;
      const tx = -Math.sin(ea) * sgn, ty = Math.cos(ea) * sgn;
      ctx.beginPath();
      ctx.moveTo(ex + tx * cell * 0.1, ey + ty * cell * 0.1);
      ctx.lineTo(ex - ty * cell * 0.08, ey + tx * cell * 0.08);
      ctx.lineTo(ex + ty * cell * 0.08, ey - tx * cell * 0.08);
      ctx.closePath(); ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#1c1d20"; ctx.beginPath(); ctx.arc(0, 0, R * 0.16, 0, 6.283); ctx.fill();
    ctx.restore();
  });
}

/* ---------- pickups ---------- */
function drawPickups(ctx, board, cell, now, taken) {
  (board.pickups || []).forEach((p, i) => {
    const off = taken.includes(p.id);
    const cx = p.x * cell + cell / 2, cy = p.y * cell + cell / 2 + (off ? 0 : Math.sin(now / 380 + i) * cell * 0.04);
    ctx.save();
    if (off) { ctx.globalAlpha = 0.35; ctx.filter = "grayscale(1)"; }
    // pad
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath(); ctx.ellipse(p.x * cell + cell / 2, p.y * cell + cell * 0.78, cell * 0.26, cell * 0.08, 0, 0, 6.283); ctx.fill();
    ctx.translate(cx, cy);
    const s = cell * 0.3;
    const glow = { bomb: "#ff7a00", double_laser: "#ffd400", shield: "#3b82f6", life: "#ef4444" }[p.type];
    if (!off) { ctx.shadowColor = glow; ctx.shadowBlur = cell * (0.3 + 0.1 * Math.sin(now / 200)); }
    ctx.lineJoin = "round"; ctx.strokeStyle = "#111"; ctx.lineWidth = Math.max(1.5, cell * 0.035);
    if (p.type === "bomb") {
      const g = ctx.createRadialGradient(-s * 0.35, -s * 0.35, 0, 0, 0, s);
      g.addColorStop(0, "#6b7280"); g.addColorStop(1, "#0b0b0d");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.85, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#8a8f96"; ctx.fillRect(-s * 0.2, -s * 0.85, s * 0.4, s * 0.25);
      ctx.strokeStyle = "#c9a26b"; ctx.lineWidth = cell * 0.03;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.85); ctx.quadraticCurveTo(s * 0.4, -s * 1.2, s * 0.55, -s * 1.0); ctx.stroke();
      if (!off) { ctx.fillStyle = Math.sin(now / 60) > 0 ? "#fff3b0" : "#ff9a1f"; ctx.beginPath(); ctx.arc(s * 0.58, -s * 1.02, s * 0.16, 0, 6.283); ctx.fill(); }
    } else if (p.type === "double_laser") {
      ctx.fillStyle = "#ffd400";
      ctx.beginPath();
      [[0.25, -1.1], [-0.55, 0.15], [-0.05, 0.15], [-0.3, 1.1], [0.55, -0.2], [0.05, -0.2]].forEach(([x, y], k) => (k ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (p.type === "shield") {
      const g = ctx.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, "#93c5fd"); g.addColorStop(1, "#1d4ed8");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.85, -s * 0.6); ctx.quadraticCurveTo(s * 0.8, s * 0.6, 0, s * 1.05);
      ctx.quadraticCurveTo(-s * 0.8, s * 0.6, -s * 0.85, -s * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = cell * 0.025;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.6); ctx.lineTo(0, s * 0.6); ctx.stroke();
    } else {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.moveTo(0, s * 0.95);
      ctx.bezierCurveTo(-s * 1.3, 0, -s * 0.7, -s * 1.1, 0, -s * 0.45);
      ctx.bezierCurveTo(s * 0.7, -s * 1.1, s * 1.3, 0, 0, s * 0.95);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = "#fff";
      ctx.fillRect(-s * 0.09, -s * 0.35, s * 0.18, s * 0.6); ctx.fillRect(-s * 0.3, -s * 0.14, s * 0.6, s * 0.18);
    }
    ctx.restore();
  });
}

/* ---------- board lasers: emitter housing + live beam ---------- */
function blocked(board, x, y, d) {
  const [dx, dy] = VEC[d];
  return (board.walls || []).some(([wx, wy, wd]) =>
    (wx === x && wy === y && wd === d) || (wx === x + dx && wy === y + dy && wd === (d + 2) % 4));
}
function drawBoardLasers(ctx, board, robots, cell, now) {
  const occ = new Set(robots.filter((r) => r.alive !== false && !r.eliminated && !r.dead).map((r) => `${r.x},${r.y}`));
  (board.lasers || []).forEach((lz, i) => {
    const [dx, dy] = VEC[lz.dir];
    let x = lz.x, y = lz.y;
    while (!occ.has(`${x},${y}`) && !blocked(board, x, y, lz.dir) && x + dx >= 0 && y + dy >= 0 && x + dx < board.width && y + dy < board.height) {
      x += dx; y += dy;
    }
    const hitRobot = occ.has(`${x},${y}`);
    const bx0 = lz.x - dx, by0 = lz.y - dy;
    const back = bx0 < 0 || by0 < 0 || bx0 >= board.width || by0 >= board.height ? 0.84 : 0.22;
    const sx = lz.x * cell + cell / 2 - dx * cell * back, sy = lz.y * cell + cell / 2 - dy * cell * back;
    const ex = x * cell + cell / 2 + dx * (hitRobot ? -cell * 0.3 : cell * 0.5), ey = y * cell + cell / 2 + dy * (hitRobot ? -cell * 0.3 : cell * 0.5);
    const fl = 0.8 + 0.2 * Math.sin(now / 55 + i * 3);
    ctx.save();
    ctx.lineCap = "round";
    ctx.shadowColor = "#ff8a00"; ctx.shadowBlur = cell * 0.5;
    ctx.strokeStyle = rgba("#ff7a00", 0.4 * fl); ctx.lineWidth = cell * 0.22;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = rgba("#ffb347", 0.9 * fl); ctx.lineWidth = cell * 0.1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba("#fff4d6", fl); ctx.lineWidth = cell * 0.035;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    if (hitRobot) {
      ctx.fillStyle = rgba("#ffd27a", 0.7 * fl);
      ctx.beginPath(); ctx.arc(ex, ey, cell * 0.12 * fl, 0, 6.283); ctx.fill();
    }
    ctx.restore();
    drawEmitter(ctx, lz, cell, fl, board);
  });
}
function drawEmitter(ctx, lz, cell, fl, board) {
  const [dx, dy] = VEC[lz.dir];
  const bx = lz.x - dx, by = lz.y - dy;
  const inFrame = bx < 0 || by < 0 || bx >= board.width || by >= board.height;
  const off = inFrame ? cell * 0.62 : 0;
  ctx.save();
  ctx.translate(lz.x * cell + cell / 2 - dx * off, lz.y * cell + cell / 2 - dy * off);
  ctx.rotate(ROT[lz.dir]);
  // base plate at back edge
  ctx.fillStyle = "#3b3d42"; ctx.strokeStyle = "#0d0d0f"; ctx.lineWidth = 1.5;
  roundRect(ctx, -cell * 0.34, cell * 0.3, cell * 0.68, cell * 0.2, 3); ctx.fill(); ctx.stroke();
  // cylinder body
  const g = ctx.createLinearGradient(-cell * 0.2, 0, cell * 0.2, 0);
  g.addColorStop(0, "#3c3e43"); g.addColorStop(0.4, "#b8bcc3"); g.addColorStop(0.7, "#7b7f86"); g.addColorStop(1, "#2c2e32");
  ctx.fillStyle = g;
  roundRect(ctx, -cell * 0.2, -cell * 0.22, cell * 0.4, cell * 0.56, cell * 0.06); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#1b1c1f";
  [[-0.13, 0.4], [0.13, 0.4]].forEach(([bx, by]) => { ctx.beginPath(); ctx.arc(bx * cell, by * cell, cell * 0.03, 0, 6.283); ctx.fill(); });
  // glowing nozzle
  ctx.shadowColor = "#ff8a00"; ctx.shadowBlur = cell * 0.45 * fl;
  const ng = ctx.createRadialGradient(0, -cell * 0.22, 0, 0, -cell * 0.22, cell * 0.17);
  ng.addColorStop(0, "#fff4d6"); ng.addColorStop(0.45, "#ffa31a"); ng.addColorStop(1, "#c2410c");
  ctx.fillStyle = ng;
  ctx.beginPath(); ctx.ellipse(0, -cell * 0.22, cell * 0.16, cell * 0.09, 0, 0, 6.283); ctx.fill();
  ctx.restore();
}

/* ---------- walls: steel barriers ---------- */
function drawWalls(ctx, board, cell) {
  (board.walls || []).forEach(([wx, wy, d]) => {
    ctx.save();
    ctx.translate(wx * cell + cell / 2, wy * cell + cell / 2);
    ctx.rotate(ROT[d]);
    const t = cell * 0.17, L = cell * 1.04;
    ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = cell * 0.15; ctx.shadowOffsetY = 2;
    const g = ctx.createLinearGradient(0, -cell / 2 - t / 2, 0, -cell / 2 + t / 2);
    g.addColorStop(0, "#c7cbd1"); g.addColorStop(0.45, "#80848b"); g.addColorStop(1, "#33353a");
    ctx.fillStyle = g; ctx.strokeStyle = "#0c0c0e"; ctx.lineWidth = 1.5;
    roundRect(ctx, -L / 2, -cell / 2 - t / 2, L, t, t * 0.35); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.stroke();
    ctx.fillStyle = "#2a2b2f";
    [-L * 0.38, 0, L * 0.38].forEach((bx) => { ctx.beginPath(); ctx.arc(bx, -cell / 2, t * 0.2, 0, 6.283); ctx.fill(); });
    ctx.restore();
  });
}

/* ---------- planned path preview ---------- */
function drawPlan(ctx, plan, cell, now, active) {
  const pts = previewPath(plan);
  if (pts.length < 2) return;
  const c = plan.color;
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.45;
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.strokeStyle = rgba(c, 0.28); ctx.lineWidth = cell * 0.34;
  ctx.beginPath();
  pts.forEach((p, i) => { const x = p.x * cell + cell / 2, y = p.y * cell + cell / 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
  ctx.shadowColor = c; ctx.shadowBlur = cell * 0.2;
  const pulse = (now / 700) % 1;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (a.x === b.x && a.y === b.y) continue;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    [0.35, 0.7].forEach((f) => {
      const x = lerp(a.x, b.x, f) * cell + cell / 2, y = lerp(a.y, b.y, f) * cell + cell / 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.strokeStyle = rgba(c, 0.55 + 0.45 * Math.sin((f + pulse) * Math.PI));
      ctx.lineWidth = cell * 0.06;
      ctx.beginPath(); ctx.moveTo(-cell * 0.06, -cell * 0.1); ctx.lineTo(cell * 0.05, 0); ctx.lineTo(-cell * 0.06, cell * 0.1); ctx.stroke();
      ctx.restore();
    });
  }
  // ghost end position
  const end = pts[pts.length - 1];
  const ex = end.x * cell, ey = end.y * cell;
  ctx.setLineDash([cell * 0.1, cell * 0.07]);
  ctx.strokeStyle = rgba(c, 0.9); ctx.lineWidth = 2;
  roundRect(ctx, ex + cell * 0.1, ey + cell * 0.1, cell * 0.8, cell * 0.8, cell * 0.12); ctx.stroke();
  ctx.setLineDash([]);
  ctx.translate(ex + cell / 2, ey + cell / 2); ctx.rotate(ROT[end.dir]);
  ctx.fillStyle = rgba(c, 0.9);
  ctx.beginPath(); ctx.moveTo(0, -cell * 0.3); ctx.lineTo(-cell * 0.1, -cell * 0.16); ctx.lineTo(cell * 0.1, -cell * 0.16); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---------- robots ---------- */
function brackets(ctx, x, y, s, col, alpha) {
  ctx.strokeStyle = rgba(col, alpha); ctx.lineWidth = 2;
  const k = s * 0.22;
  [[x, y, 1, 1], [x + s, y, -1, 1], [x, y + s, 1, -1], [x + s, y + s, -1, -1]].forEach(([px, py, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(px, py + sy * k); ctx.lineTo(px, py); ctx.lineTo(px + sx * k, py); ctx.stroke();
  });
}
function drawRobot(ctx, r, disp, cell, now, active, fx) {
  if (r.eliminated || r.dead || r.alive === false) { delete disp[r.id]; return; }
  let d = disp[r.id];
  if (!d) d = disp[r.id] = { x: r.x, y: r.y, ang: ROT[r.dir], tread: 0, moving: 0 };
  const ox = d.x, oy = d.y, oa = d.ang;
  d.x = lerp(d.x, r.x, 0.16); d.y = lerp(d.y, r.y, 0.16);
  d.ang = lerpAngle(d.ang, ROT[r.dir], 0.18);
  // tread travel: forward component of the motion (+ rotation)
  const fwd = (d.x - ox) * Math.sin(d.ang) - (d.y - oy) * Math.cos(d.ang);
  const spin = d.ang - oa;
  d.tread += fwd * cell;
  d.spin = (d.spin || 0) + spin * cell * 0.35;
  d.moving = Math.max(Math.abs(fwd) + Math.abs(d.x - ox) + Math.abs(d.y - oy) + Math.abs(spin) * 0.3 > 0.002 ? 1 : 0, d.moving * 0.9);
  const px = d.x * cell, py = d.y * cell, cx = px + cell / 2, cy = py + cell / 2;

  ctx.fillStyle = rgba(r.color, active ? 0.22 : 0.12);
  ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
  brackets(ctx, px + 3, py + 3, cell - 6, r.color, active ? 0.95 : 0.5);

  // recoil when this robot fires in the current frame
  let kick = 0, flash = 0;
  const weapon = fx.recoil && fx.recoil[r.id];
  if (weapon) {
    const rp = (now - fx.t0) / 320;
    if (rp < 1) { kick = Math.sin(rp * Math.PI) * cell * (weapon === "blast" ? 0.04 : 0.1); flash = 1 - rp; }
  }
  const [file, filter] = ROBOT_SPRITE[r.color] || ROBOT_SPRITE["#ef4444"];
  const img = sprite(file);
  const s = cell * 0.86 * (weapon === "blast" && flash ? 1 + flash * 0.08 : 1);
  ctx.save();
  if (r.invuln) ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(now / 120));
  ctx.translate(cx, cy); ctx.rotate(d.ang);
  ctx.translate(0, kick);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.75)"; ctx.shadowBlur = cell * 0.16; ctx.shadowOffsetY = cell * 0.05;
  if (filter) ctx.filter = filter;
  if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
  else { ctx.fillStyle = r.color; roundRect(ctx, -s / 2, -s / 2, s, s, cell * 0.12); ctx.fill(); }
  ctx.restore();
  // rolling treads
  if (d.moving > 0.05) {
    const gap = s * 0.1;
    [[-1, d.tread + d.spin], [1, d.tread - d.spin]].forEach(([side, off]) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(side < 0 ? -s * 0.47 : s * 0.29, -s * 0.4, s * 0.18, s * 0.8); ctx.clip();
      ctx.strokeStyle = `rgba(10,10,12,${0.55 * d.moving})`; ctx.lineWidth = Math.max(1.2, s * 0.035);
      const o = ((off % gap) + gap) % gap;
      for (let y = -s * 0.45 + o; y < s * 0.45; y += gap) {
        ctx.beginPath(); ctx.moveTo(-s / 2, y); ctx.lineTo(s / 2, y); ctx.stroke();
      }
      ctx.restore();
    });
  }
  if (flash && weapon !== "blast") {
    ctx.shadowColor = "#ffb347"; ctx.shadowBlur = cell * 0.4;
    ctx.fillStyle = rgba("#fff1c2", flash);
    ctx.beginPath(); ctx.arc(0, -s * 0.52, cell * 0.12 * flash + 2, 0, 6.283); ctx.fill();
  }
  ctx.restore();

  if (r.shield || r.invuln) drawBubble(ctx, cx, cy, cell, now, r.invuln && !r.shield);

  const bw = cell * 0.7, bx = cx - bw / 2, by = py + cell - cell * 0.1;
  const seg = bw / r.max_hp;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  roundRect(ctx, bx - 2, by - 2, bw + 4, cell * 0.09 + 4, 2); ctx.fill();
  for (let i = 0; i < r.max_hp; i++) {
    ctx.fillStyle = i < r.hp ? (r.hp <= 2 ? "#ef4444" : "#ff9a1f") : "rgba(255,255,255,0.12)";
    ctx.fillRect(bx + i * seg + 0.5, by, seg - 1.5, cell * 0.09);
  }
  ctx.font = `700 ${Math.max(8, cell * 0.16)}px 'Russo One', sans-serif`;
  const tw = ctx.measureText(r.name).width + 8;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  roundRect(ctx, cx - tw / 2, py - cell * 0.06, tw, cell * 0.2, 3); ctx.fill();
  ctx.fillStyle = r.color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(r.name, cx, py + cell * 0.04);
  ctx.textBaseline = "alphabetic";
}
function drawBubble(ctx, cx, cy, cell, now, faint) {
  const R = cell * 0.56, pulse = 0.5 + 0.5 * Math.sin(now / 200);
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R);
  g.addColorStop(0, "rgba(59,130,246,0)"); g.addColorStop(0.8, `rgba(96,165,250,${faint ? 0.12 : 0.22})`); g.addColorStop(1, `rgba(147,197,253,${faint ? 0.3 : 0.55})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();
  ctx.shadowColor = "#60a5fa"; ctx.shadowBlur = cell * 0.35;
  ctx.strokeStyle = `rgba(147,197,253,${0.55 + pulse * 0.4})`; ctx.lineWidth = cell * 0.04;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
  const rot = now / 700;
  ctx.strokeStyle = "rgba(224,242,254,0.9)"; ctx.lineWidth = cell * 0.03;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, rot, rot + 0.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, rot + Math.PI, rot + Math.PI + 0.6); ctx.stroke();
  ctx.restore();
}

function drawPopup(ctx, p, d, cell, now) {
  const k = (now - p.t0) / 1500;
  const x = ((d ? d.x : p.x) + 0.5) * cell;
  const y = (d ? d.y : p.y) * cell - cell * 0.15 - k * cell * 0.7;
  const pop = Math.min(1, k / 0.12);
  ctx.save();
  ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
  ctx.font = `700 ${Math.max(11, cell * 0.28) * (0.6 + 0.4 * pop)}px 'Russo One', sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(3, cell * 0.07); ctx.strokeStyle = "rgba(0,0,0,0.9)"; ctx.lineJoin = "round";
  ctx.strokeText(p.text, x, y);
  ctx.shadowColor = p.color; ctx.shadowBlur = cell * 0.25;
  ctx.fillStyle = p.color; ctx.fillText(p.text, x, y);
  ctx.restore();
}

/* ---------- effects: lasers / blast / bomb ---------- */
function drawEffects(ctx, fx, cell, now) {
  const age = now - fx.t0;
  if (age > LIFE || !fx.list.length) return;
  const p = age / LIFE;
  fx.list.forEach((b) => {
    const fxp = b.from[0] * cell + cell / 2, fyp = b.from[1] * cell + cell / 2;
    const txp = b.to[0] * cell + cell / 2, typ = b.to[1] * cell + cell / 2;
    if (b.type === "explode") return explosion(ctx, fxp, fyp, cell * 1.3, p, b.parts, cell, "#ff5a1f");
    if (b.type === "blast") return blueBlast(ctx, fxp, fyp, p, cell);
    if (b.type === "bomb") {
      const tp = Math.min(1, p / 0.3);
      const bx = lerp(fxp, txp, tp), by = lerp(fyp, typ, tp) - Math.sin(tp * Math.PI) * cell * 0.6;
      if (p < 0.3) {
        ctx.fillStyle = "#1f2937"; ctx.strokeStyle = "#ffb347"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, cell * 0.13, 0, 6.283); ctx.fill(); ctx.stroke();
      } else explosion(ctx, txp, typ, cell * 1.15, (p - 0.3) / 0.7, b.parts, cell, "#ff7a00");
      return;
    }
    const col = b.type === "board_laser" ? "#ff7a00" : "#ffd27a";
    beamLine(ctx, fxp, fyp, txp, typ, p, col, cell, b.type === "double_laser" ? 2 : 1);
    if (b.hit && p > 0.2 && p < 0.7) {
      ctx.fillStyle = rgba(col, (1 - (p - 0.2) / 0.5) * 0.8);
      ctx.beginPath(); ctx.arc(txp, typ, cell * (0.18 + p * 0.25), 0, 6.283); ctx.fill();
    }
  });
}
function beamLine(ctx, fx, fy, tx, ty, p, col, cell, mult) {
  const ext = Math.min(1, p / 0.18);
  const ex = fx + (tx - fx) * ext, ey = fy + (ty - fy) * ext;
  const alpha = p < 0.62 ? 1 : Math.max(0, 1 - (p - 0.62) / 0.38);
  if (alpha <= 0) return;
  const ang = Math.atan2(ty - fy, tx - fx);
  const nx = Math.sin(ang), ny = -Math.cos(ang);
  const offs = mult === 2 ? [-cell * 0.09, cell * 0.09] : [0];
  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowColor = rgba(col, alpha); ctx.shadowBlur = cell * 0.45;
  offs.forEach((o) => {
    ctx.strokeStyle = rgba(col, alpha * 0.4); ctx.lineWidth = cell * 0.24;
    ctx.beginPath(); ctx.moveTo(fx + nx * o, fy + ny * o); ctx.lineTo(ex + nx * o, ey + ny * o); ctx.stroke();
    ctx.strokeStyle = rgba("#fff7e6", alpha); ctx.lineWidth = cell * 0.07;
    ctx.beginPath(); ctx.moveTo(fx + nx * o, fy + ny * o); ctx.lineTo(ex + nx * o, ey + ny * o); ctx.stroke();
  });
  ctx.restore();
  const mf = Math.max(0, 1 - p / 0.4);
  if (mf > 0) {
    ctx.fillStyle = rgba(col, mf);
    ctx.beginPath(); ctx.arc(fx, fy, cell * 0.16 * mf + cell * 0.05, 0, 6.283); ctx.fill();
  }
}
// blue shockwave covering the 8 surrounding cells (diagonals included)
function blueBlast(ctx, cx, cy, p, cell) {
  const a = p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.15) / 0.85);
  const grow = Math.min(1, p / 0.3);
  ctx.save();
  ctx.shadowColor = "#3b9cff"; ctx.shadowBlur = cell * 0.6;
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      if (!ox && !oy) continue;
      const x = cx + ox * cell * grow, y = cy + oy * cell * grow;
      ctx.fillStyle = `rgba(59,156,255,${0.32 * a})`;
      roundRect(ctx, x - cell * 0.46, y - cell * 0.46, cell * 0.92, cell * 0.92, cell * 0.14); ctx.fill();
      ctx.strokeStyle = `rgba(147,206,255,${0.85 * a})`; ctx.lineWidth = Math.max(1.5, cell * 0.04);
      ctx.stroke();
    }
  }
  const R = cell * (0.4 + 1.15 * grow);
  const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
  g.addColorStop(0, `rgba(224,242,254,${0.75 * a})`); g.addColorStop(0.55, `rgba(59,156,255,${0.4 * a})`); g.addColorStop(1, "rgba(59,156,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();
  ctx.strokeStyle = `rgba(125,200,255,${a})`; ctx.lineWidth = cell * 0.08 * (1 - p * 0.6);
  ctx.beginPath(); ctx.arc(cx, cy, cell * 1.5 * grow + cell * 0.1, 0, 6.283); ctx.stroke();
  ctx.restore();
}

function explosion(ctx, cx, cy, maxR, p, parts, cell, col) {
  if (p < 0 || p > 1) return;
  const alpha = 1 - p;
  ctx.strokeStyle = rgba(col, alpha * 0.9);
  ctx.lineWidth = cell * 0.1 * (1 - p * 0.6);
  ctx.beginPath(); ctx.arc(cx, cy, maxR * p + cell * 0.15, 0, 6.283); ctx.stroke();
  if (p < 0.4) {
    const cf = 1 - p / 0.4;
    ctx.fillStyle = rgba("#fff2cc", cf);
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.4 * cf + cell * 0.1, 0, 6.283); ctx.fill();
  }
  ctx.save();
  ctx.shadowColor = rgba(col, alpha); ctx.shadowBlur = cell * 0.5;
  ctx.fillStyle = rgba(col, alpha * 0.5);
  ctx.beginPath(); ctx.arc(cx, cy, maxR * 0.45 * (1 - p) + cell * 0.08, 0, 6.283); ctx.fill();
  ctx.restore();
  (parts || []).forEach((pt) => {
    const dist = pt.spd * maxR * p;
    ctx.fillStyle = rgba(p < 0.5 ? "#ffd27a" : col, alpha);
    ctx.beginPath(); ctx.arc(cx + Math.cos(pt.ang) * dist, cy + Math.sin(pt.ang) * dist, pt.sz * (1 - p * 0.7), 0, 6.283); ctx.fill();
  });
}

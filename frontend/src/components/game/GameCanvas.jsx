import React, { useEffect, useRef } from "react";

/* ---------- helpers ---------- */
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function hashCell(x, y) {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 100;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const DIR_ANGLE = { 0: -Math.PI / 2, 1: 0, 2: Math.PI / 2, 3: Math.PI };
const LIFE = 620; // ms per effect

export default function GameCanvas({ board, robots, beams }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const dispRef = useRef({});
  const fxRef = useRef({ t0: 0, list: [] });
  const dataRef = useRef({ board, robots });
  dataRef.current = { board, robots };

  // build effects (with particles) whenever beams change
  useEffect(() => {
    const list = (beams || []).map((b) => {
      const explode = b.type === "bomb" || b.type === "blast";
      const parts = explode
        ? Array.from({ length: 16 }, () => ({
            ang: Math.random() * Math.PI * 2,
            spd: 0.5 + Math.random() * 1.1,
            sz: 1.5 + Math.random() * 2.5,
          }))
        : null;
      return { ...b, parts };
    });
    fxRef.current = { t0: performance.now(), list };
  }, [beams]);

  useEffect(() => {
    let raf;
    const ctx = canvasRef.current.getContext("2d");

    const draw = () => {
      const now = performance.now();
      const { board, robots } = dataRef.current;
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!board || !canvas || !wrap) { raf = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const margin = 0; // frame drawn inside
      const availW = wrap.clientWidth;
      const cell = Math.max(20, Math.floor((availW - 2) / board.width));
      const FR = Math.max(10, Math.round(cell * 0.42)); // frame thickness
      const w = cell * board.width;
      const h = cell * board.height;
      const W = w + FR * 2;
      const H = h + FR * 2;
      if (canvas.width !== W * dpr) {
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      drawFrame(ctx, W, H, FR, cell, now);

      ctx.save();
      ctx.translate(FR, FR);

      drawTiles(ctx, board, cell);
      drawHoles(ctx, board, cell, now);
      drawConveyors(ctx, board, cell, now);
      drawGrid(ctx, board, cell);
      drawEmitters(ctx, board, cell, now);
      drawWalls(ctx, board, cell);

      // under-robot effects (explosions draw partly behind? keep above)
      robots.forEach((r) => drawRobot(ctx, r, dispRef.current, cell, now));
      drawEffects(ctx, fxRef.current, cell, now);

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="w-full flex justify-center" data-testid="game-canvas-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}

/* ---------- industrial frame ---------- */
function drawFrame(ctx, W, H, FR, cell, now) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#3a3a40");
  g.addColorStop(0.5, "#24242a");
  g.addColorStop(1, "#141418");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // inner shadow
  ctx.fillStyle = "#0b0b0e";
  ctx.fillRect(FR - 3, FR - 3, W - 2 * FR + 6, H - 2 * FR + 6);
  // bevel highlight
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  // corner + edge bolts
  const pulse = 0.5 + 0.5 * Math.sin(now / 600);
  ctx.fillStyle = "#4a4a52";
  const bolt = (bx, by) => {
    ctx.beginPath(); ctx.arc(bx, by, FR * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1c1c20";
    ctx.beginPath(); ctx.arc(bx, by, FR * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4a4a52";
  };
  const positions = [[FR / 2, FR / 2], [W - FR / 2, FR / 2], [FR / 2, H - FR / 2], [W - FR / 2, H - FR / 2]];
  positions.forEach(([bx, by]) => bolt(bx, by));
  // energy conduits accent (top & bottom center)
  ctx.strokeStyle = rgba("#ff9500", 0.25 + pulse * 0.3);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W * 0.35, FR / 2); ctx.lineTo(W * 0.65, FR / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W * 0.35, H - FR / 2); ctx.lineTo(W * 0.65, H - FR / 2); ctx.stroke();
}

/* ---------- tiles ---------- */
function drawTiles(ctx, board, cell) {
  for (let x = 0; x < board.width; x++) {
    for (let y = 0; y < board.height; y++) {
      const hsh = hashCell(x, y);
      let base = "#2b2b31";
      if (hsh < 14) base = "#332a26";      // rust patch
      else if (hsh < 30) base = "#26262c";
      else if (hsh > 86) base = "#313138";
      const px = x * cell, py = y * cell;
      ctx.fillStyle = base;
      ctx.fillRect(px, py, cell, cell);
      // bevel
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, py + cell - 0.5); ctx.lineTo(px + 0.5, py + 0.5); ctx.lineTo(px + cell - 0.5, py + 0.5);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.moveTo(px + cell - 0.5, py + 0.5); ctx.lineTo(px + cell - 0.5, py + cell - 0.5); ctx.lineTo(px + 0.5, py + cell - 0.5);
      ctx.stroke();
      // rivets
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      const rv = Math.max(1, cell * 0.035);
      [[px + cell * 0.14, py + cell * 0.14], [px + cell * 0.86, py + cell * 0.14],
       [px + cell * 0.14, py + cell * 0.86], [px + cell * 0.86, py + cell * 0.86]].forEach(([rx, ry]) => {
        ctx.beginPath(); ctx.arc(rx, ry, rv, 0, Math.PI * 2); ctx.fill();
      });
    }
  }
}

function drawGrid(ctx, board, cell) {
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= board.width; x++) { ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, board.height * cell); ctx.stroke(); }
  for (let y = 0; y <= board.height; y++) { ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(board.width * cell, y * cell); ctx.stroke(); }
}

/* ---------- holes ---------- */
function drawHoles(ctx, board, cell, now) {
  (board.holes || []).forEach(([hx, hy]) => {
    const px = hx * cell, py = hy * cell;
    const g = ctx.createRadialGradient(px + cell / 2, py + cell / 2, 1, px + cell / 2, py + cell / 2, cell * 0.6);
    g.addColorStop(0, "#000");
    g.addColorStop(0.7, "#050505");
    g.addColorStop(1, "#1a120d");
    ctx.fillStyle = g;
    ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
    // hazard corner ticks
    const pulse = 0.4 + 0.3 * Math.sin(now / 350 + hx);
    ctx.strokeStyle = rgba("#ff7a00", pulse);
    ctx.lineWidth = 2;
    const t = cell * 0.22, o = cell * 0.1;
    const corners = [[o, o, 1, 1], [cell - o, o, -1, 1], [o, cell - o, 1, -1], [cell - o, cell - o, -1, -1]];
    corners.forEach(([cxp, cyp, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(px + cxp, py + cyp + sy * t); ctx.lineTo(px + cxp, py + cyp); ctx.lineTo(px + cxp + sx * t, py + cyp);
      ctx.stroke();
    });
  });
}

/* ---------- conveyors ---------- */
function drawConveyors(ctx, board, cell, now) {
  const flow = (now / 420) % 1;
  (board.conveyors || []).forEach((c) => {
    const px = c.x * cell, py = c.y * cell;
    // dark metal channel
    ctx.fillStyle = "#1a1620";
    ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
    // glowing purple fill
    const g = ctx.createLinearGradient(px, py, px + cell, py + cell);
    g.addColorStop(0, rgba("#7c3aed", 0.5));
    g.addColorStop(1, rgba("#9333ea", 0.32));
    ctx.fillStyle = g;
    ctx.fillRect(px + 4, py + 4, cell - 8, cell - 8);
    // flowing chevrons
    ctx.save();
    ctx.translate(px + cell / 2, py + cell / 2);
    ctx.rotate(DIR_ANGLE[c.dir]);
    for (let i = 0; i < 2; i++) {
      const off = ((flow + i * 0.5) % 1) * cell - cell / 2;
      const a = 0.35 + 0.55 * (1 - Math.abs(off) / (cell / 2));
      ctx.strokeStyle = rgba("#d8b4fe", Math.max(0.1, a));
      ctx.lineWidth = Math.max(2, cell * 0.08);
      ctx.beginPath();
      ctx.moveTo(off - cell * 0.16, -cell * 0.16);
      ctx.lineTo(off + cell * 0.04, 0);
      ctx.lineTo(off - cell * 0.16, cell * 0.16);
      ctx.stroke();
    }
    ctx.restore();
  });
}

/* ---------- board laser emitters ---------- */
function drawEmitters(ctx, board, cell, now) {
  const pulse = 0.4 + 0.35 * Math.sin(now / 240);
  (board.lasers || []).forEach((lz) => {
    const cx = lz.x * cell + cell / 2, cy = lz.y * cell + cell / 2;
    const a = DIR_ANGLE[lz.dir];
    const ex = cx + Math.cos(a) * cell * board.width, ey = cy + Math.sin(a) * cell * board.height;
    ctx.strokeStyle = rgba("#ff7a00", 0.1 + pulse * 0.12);
    ctx.lineWidth = cell * 0.12;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    // emitter housing
    ctx.fillStyle = "#3a3a42";
    roundRect(ctx, cx - cell * 0.22, cy - cell * 0.22, cell * 0.44, cell * 0.44, cell * 0.08); ctx.fill();
    ctx.fillStyle = rgba("#ff8c00", 0.6 + pulse * 0.4);
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.12, 0, Math.PI * 2); ctx.fill();
  });
}

/* ---------- walls ---------- */
function drawWalls(ctx, board, cell) {
  (board.walls || []).forEach(([wx, wy, d]) => {
    const px = wx * cell, py = wy * cell;
    let x1, y1, x2, y2;
    if (d === 0) { x1 = px; y1 = py; x2 = px + cell; y2 = py; }
    else if (d === 1) { x1 = px + cell; y1 = py; x2 = px + cell; y2 = py + cell; }
    else if (d === 2) { x1 = px; y1 = py + cell; x2 = px + cell; y2 = py + cell; }
    else { x1 = px; y1 = py; x2 = px; y2 = py + cell; }
    ctx.strokeStyle = "#111";
    ctx.lineWidth = cell * 0.17;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = cell * 0.1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = rgba("#ffd27a", 0.7);
    ctx.lineWidth = Math.max(1, cell * 0.025);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
}

/* ---------- robots ---------- */
function drawRobot(ctx, r, disp, cell, now) {
  if (r.eliminated) { delete disp[r.id]; return; }
  let d = disp[r.id];
  if (!d) d = disp[r.id] = { x: r.x, y: r.y, ang: r.dir * Math.PI / 2 };
  d.x = lerp(d.x, r.x, 0.2);
  d.y = lerp(d.y, r.y, 0.2);
  d.ang = lerpAngle(d.ang, r.dir * Math.PI / 2, 0.22);
  const cx = d.x * cell + cell / 2, cy = d.y * cell + cell / 2;
  const rad = cell * 0.34;

  // halo
  if (r.shield || r.invuln) {
    const pulse = 0.55 + 0.45 * Math.sin(now / 180);
    const col = r.invuln ? "#38bdf8" : "#8b5cf6";
    ctx.strokeStyle = rgba(col, 0.4 + pulse * 0.5);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, rad + 5 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = rgba(col, 0.08);
    ctx.beginPath(); ctx.arc(cx, cy, rad + 6, 0, Math.PI * 2); ctx.fill();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(d.ang);

  // treads (fixed to body, along facing axis)
  ctx.fillStyle = "#17171a";
  roundRect(ctx, -rad - cell * 0.06, -rad, cell * 0.14, rad * 2, 2); ctx.fill();
  roundRect(ctx, rad - cell * 0.08, -rad, cell * 0.14, rad * 2, 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    const ty = i * rad * 0.4;
    ctx.beginPath(); ctx.moveTo(-rad - cell * 0.06, ty); ctx.lineTo(-rad + cell * 0.08, ty); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rad - cell * 0.08, ty); ctx.lineTo(rad + cell * 0.08, ty); ctx.stroke();
  }

  // body
  const g = ctx.createLinearGradient(-rad, -rad, rad, rad);
  g.addColorStop(0, shade(r.color, 0.18));
  g.addColorStop(0.5, r.color);
  g.addColorStop(1, shade(r.color, -0.25));
  ctx.fillStyle = g;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 2;
  roundRect(ctx, -rad, -rad, rad * 2, rad * 2, cell * 0.12);
  ctx.fill(); ctx.stroke();

  // cockpit
  ctx.fillStyle = shade(r.color, -0.35);
  ctx.beginPath(); ctx.arc(0, 0, rad * 0.5, 0, Math.PI * 2); ctx.fill();

  // bright direction arrow (points up local = N, rotated by dir)
  ctx.fillStyle = shade(r.color, 0.45);
  ctx.beginPath();
  ctx.moveTo(0, -rad * 0.78);
  ctx.lineTo(-rad * 0.34, -rad * 0.05);
  ctx.lineTo(rad * 0.34, -rad * 0.05);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1; ctx.stroke();

  ctx.restore();

  // hp bar
  const bw = rad * 2, bx = cx - rad, by = cy + rad + 4;
  const seg = bw / r.max_hp;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
  for (let i = 0; i < r.max_hp; i++) {
    ctx.fillStyle = i < r.hp ? (r.hp <= 2 ? "#ef4444" : r.color) : "rgba(255,255,255,0.12)";
    ctx.fillRect(bx + i * seg + 1, by, seg - 2, 3);
  }
  // name
  ctx.fillStyle = "#e5e7eb";
  ctx.font = `600 ${Math.max(8, cell * 0.19)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText(r.name, cx, by + 6);
  ctx.textBaseline = "alphabetic";
}

/* ---------- effects: lasers / blast / bomb ---------- */
function drawEffects(ctx, fx, cell, now) {
  const age = now - fx.t0;
  if (age > LIFE || !fx.list.length) return;
  const p = age / LIFE;

  fx.list.forEach((b) => {
    const fxp = b.from[0] * cell + cell / 2, fyp = b.from[1] * cell + cell / 2;
    const txp = b.to[0] * cell + cell / 2, typ = b.to[1] * cell + cell / 2;

    if (b.type === "blast") {
      explosion(ctx, fxp, fyp, cell * 0.95, p, b.parts, cell, "#f97316");
      // 4-direction mini shock
      return;
    }
    if (b.type === "bomb") {
      // short trail then explosion at target
      beamLine(ctx, fxp, fyp, txp, typ, p, "#ffb347", cell, 1);
      if (p > 0.18) explosion(ctx, txp, typ, cell * 1.1, (p - 0.18) / 0.82, b.parts, cell, "#ff7a00");
      return;
    }
    // laser / double_laser / board_laser
    const col = b.type === "board_laser" ? "#ff7a00" : "#ffd27a";
    const mult = b.type === "double_laser" ? 2 : 1;
    beamLine(ctx, fxp, fyp, txp, typ, p, col, cell, mult);
    if (b.hit && p > 0.2 && p < 0.7) {
      const a = 1 - (p - 0.2) / 0.5;
      ctx.fillStyle = rgba(col, a * 0.8);
      ctx.beginPath(); ctx.arc(txp, typ, cell * (0.18 + p * 0.25), 0, Math.PI * 2); ctx.fill();
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
  const offs = mult === 2 ? [-cell * 0.08, cell * 0.08] : [0];

  ctx.save();
  ctx.shadowColor = rgba(col, alpha);
  ctx.shadowBlur = cell * 0.4;
  offs.forEach((o) => {
    // outer glow
    ctx.strokeStyle = rgba(col, alpha * 0.35);
    ctx.lineWidth = cell * 0.22;
    ctx.beginPath(); ctx.moveTo(fx + nx * o, fy + ny * o); ctx.lineTo(ex + nx * o, ey + ny * o); ctx.stroke();
    // core
    ctx.strokeStyle = rgba("#fff7e6", alpha);
    ctx.lineWidth = cell * 0.07;
    ctx.beginPath(); ctx.moveTo(fx + nx * o, fy + ny * o); ctx.lineTo(ex + nx * o, ey + ny * o); ctx.stroke();
  });
  ctx.restore();
  // muzzle flash
  const mf = Math.max(0, 1 - p / 0.4);
  if (mf > 0) {
    ctx.fillStyle = rgba(col, mf);
    ctx.beginPath(); ctx.arc(fx, fy, cell * 0.16 * mf + cell * 0.05, 0, Math.PI * 2); ctx.fill();
  }
}

function explosion(ctx, cx, cy, maxR, p, parts, cell, col) {
  if (p < 0 || p > 1) return;
  const alpha = 1 - p;
  // shockwave ring
  ctx.strokeStyle = rgba(col, alpha * 0.9);
  ctx.lineWidth = cell * 0.1 * (1 - p * 0.6);
  ctx.beginPath(); ctx.arc(cx, cy, maxR * p + cell * 0.15, 0, Math.PI * 2); ctx.stroke();
  // bright core flash early
  if (p < 0.4) {
    const cf = 1 - p / 0.4;
    ctx.fillStyle = rgba("#fff2cc", cf);
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.4 * cf + cell * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  // glowing core
  ctx.save();
  ctx.shadowColor = rgba(col, alpha);
  ctx.shadowBlur = cell * 0.5;
  ctx.fillStyle = rgba(col, alpha * 0.5);
  ctx.beginPath(); ctx.arc(cx, cy, maxR * 0.45 * (1 - p) + cell * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // particles
  if (parts) {
    parts.forEach((pt) => {
      const dist = pt.spd * maxR * p;
      const x = cx + Math.cos(pt.ang) * dist, y = cy + Math.sin(pt.ang) * dist;
      ctx.fillStyle = rgba(p < 0.5 ? "#ffd27a" : col, alpha);
      ctx.beginPath(); ctx.arc(x, y, pt.sz * (1 - p * 0.7), 0, Math.PI * 2); ctx.fill();
    });
  }
}

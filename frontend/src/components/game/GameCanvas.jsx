import React, { useEffect, useRef } from "react";

const DIRV = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export default function GameCanvas({ board, robots, beams }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const dispRef = useRef({});
  const beamRef = useRef({ list: [], t: 0 });
  const dataRef = useRef({ board, robots });

  dataRef.current = { board, robots };

  useEffect(() => {
    beamRef.current = { list: beams || [], t: performance.now() };
  }, [beams]);

  useEffect(() => {
    let raf;
    const ctx = canvasRef.current.getContext("2d");

    const draw = () => {
      const { board, robots } = dataRef.current;
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!board || !canvas || !wrap) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      const availW = wrap.clientWidth;
      const cell = Math.max(18, Math.floor(availW / board.width));
      const w = cell * board.width;
      const h = cell * board.height;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // floor
      ctx.fillStyle = "#17171b";
      ctx.fillRect(0, 0, w, h);

      // tiles
      for (let x = 0; x < board.width; x++) {
        for (let y = 0; y < board.height; y++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#1d1d22" : "#191920";
          ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        }
      }

      // conveyors
      (board.conveyors || []).forEach((c) => {
        const px = c.x * cell, py = c.y * cell;
        ctx.fillStyle = "rgba(138,43,226,0.28)";
        ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 2;
        drawArrow(ctx, px + cell / 2, py + cell / 2, c.dir, cell * 0.26);
      });

      // holes
      (board.holes || []).forEach(([hx, hy]) => {
        const px = hx * cell, py = hy * cell;
        ctx.fillStyle = "#000";
        ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
        ctx.strokeStyle = "rgba(255,120,0,0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, cell - 6, cell - 6);
      });

      // grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= board.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cell, 0);
        ctx.lineTo(x * cell, h);
        ctx.stroke();
      }
      for (let y = 0; y <= board.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cell);
        ctx.lineTo(w, y * cell);
        ctx.stroke();
      }

      // board lasers emitters + faint beam
      (board.lasers || []).forEach((lz) => {
        const px = lz.x * cell + cell / 2, py = lz.y * cell + cell / 2;
        const [dx, dy] = DIRV[lz.dir];
        ctx.strokeStyle = "rgba(255,140,0,0.18)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + dx * cell * board.width, py + dy * cell * board.height);
        ctx.stroke();
        ctx.fillStyle = "#ff8c00";
        ctx.beginPath();
        ctx.arc(px, py, cell * 0.14, 0, Math.PI * 2);
        ctx.fill();
      });

      // walls
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 4;
      (board.walls || []).forEach(([wx, wy, d]) => {
        const px = wx * cell, py = wy * cell;
        ctx.beginPath();
        if (d === 0) { ctx.moveTo(px, py); ctx.lineTo(px + cell, py); }
        else if (d === 1) { ctx.moveTo(px + cell, py); ctx.lineTo(px + cell, py + cell); }
        else if (d === 2) { ctx.moveTo(px, py + cell); ctx.lineTo(px + cell, py + cell); }
        else { ctx.moveTo(px, py); ctx.lineTo(px, py + cell); }
        ctx.stroke();
      });

      // weapon beams flash
      const bt = (performance.now() - beamRef.current.t) / 450;
      if (bt < 1) {
        const alpha = 1 - bt;
        beamRef.current.list.forEach((b) => {
          const fx = b.from[0] * cell + cell / 2, fy = b.from[1] * cell + cell / 2;
          const tx = b.to[0] * cell + cell / 2, ty = b.to[1] * cell + cell / 2;
          if (b.type === "blast") {
            ctx.strokeStyle = `rgba(249,115,22,${alpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(fx, fy, cell * (0.6 + bt * 0.5), 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeStyle =
              b.type === "board_laser" ? `rgba(255,140,0,${alpha})` : `rgba(255,180,60,${alpha})`;
            ctx.lineWidth = b.type === "board_laser" ? 3 : 5;
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(tx, ty);
            ctx.stroke();
          }
        });
      }

      // robots (interpolated)
      robots.forEach((r) => {
        if (r.eliminated) {
          delete dispRef.current[r.id];
          return;
        }
        let d = dispRef.current[r.id];
        if (!d) d = dispRef.current[r.id] = { x: r.x, y: r.y, ang: r.dir * Math.PI / 2 };
        d.x = lerp(d.x, r.x, 0.22);
        d.y = lerp(d.y, r.y, 0.22);
        d.ang = lerpAngle(d.ang, r.dir * Math.PI / 2, 0.25);
        const cx = d.x * cell + cell / 2;
        const cy = d.y * cell + cell / 2;
        const rad = cell * 0.38;

        if (r.shield || r.invuln) {
          ctx.strokeStyle = r.invuln ? "rgba(96,165,250,0.8)" : "rgba(99,56,220,0.9)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, rad + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(d.ang);
        ctx.fillStyle = r.color;
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 2;
        roundRect(ctx, -rad, -rad, rad * 2, rad * 2, cell * 0.14);
        ctx.fill();
        ctx.stroke();
        // direction turret (points up in local space -> N)
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.beginPath();
        ctx.moveTo(0, -rad * 0.95);
        ctx.lineTo(-rad * 0.4, -rad * 0.2);
        ctx.lineTo(rad * 0.4, -rad * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // hp bar
        const bw = rad * 2, bx = cx - rad, by = cy + rad + 3;
        const seg = bw / r.max_hp;
        for (let i = 0; i < r.max_hp; i++) {
          ctx.fillStyle = i < r.hp ? r.color : "rgba(255,255,255,0.12)";
          ctx.fillRect(bx + i * seg + 1, by, seg - 2, 3);
        }
        // name
        ctx.fillStyle = "#e5e7eb";
        ctx.font = `600 ${Math.max(9, cell * 0.2)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(r.name, cx, by + 6);
        ctx.textBaseline = "alphabetic";
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="w-full flex justify-center" data-testid="game-canvas-wrap">
      <canvas ref={canvasRef} className="rounded-sm" style={{ imageRendering: "auto" }} />
    </div>
  );
}

function drawArrow(ctx, cx, cy, dir, s) {
  const map = { 0: -Math.PI / 2, 1: 0, 2: Math.PI / 2, 3: Math.PI };
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(map[dir]);
  ctx.beginPath();
  ctx.moveTo(-s, -s * 0.6);
  ctx.lineTo(s * 0.2, 0);
  ctx.lineTo(-s, s * 0.6);
  ctx.stroke();
  ctx.restore();
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

import { useEffect, useState } from "react";

const next = (v) => (v === 1 ? 2 : v === 2 ? 4 : 1);

// Turn replay state (frames, cursor, autoplay) with a speed remembered per mode.
export function useReplay(speedKey, defaultSpeed) {
  const [frames, setFrames] = useState(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(() => Number(localStorage.getItem(speedKey)) || defaultSpeed);

  useEffect(() => {
    if (!playing || !frames) return;
    if (frameIdx >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setFrameIdx((i) => i + 1), 650 / speed);
    return () => clearTimeout(id);
  }, [playing, frames, frameIdx, speed]);

  const cycleSpeed = () => setSpeed((v) => {
    const n = next(v);
    localStorage.setItem(speedKey, String(n));
    return n;
  });
  const start = (f) => { setFrames(f); setFrameIdx(0); setPlaying(true); };
  const clear = () => { setFrames(null); setFrameIdx(0); setPlaying(false); };
  const ended = !!frames && frameIdx >= frames.length - 1;

  return { frames, frameIdx, setFrameIdx, playing, setPlaying, speed, cycleSpeed, start, clear, ended };
}

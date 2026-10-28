import { useEffect, useRef, useState } from "react";

// WebSocket to a room, auto-reconnecting until unmount or a fatal error.
export function useRoomSocket(code, onMessage) {
  const wsRef = useRef(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer;
    const connect = () => {
      const base = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws");
      const ws = new WebSocket(`${base}/api/ws/rooms/${code}?token=${localStorage.getItem("rs_token")}`);
      wsRef.current = ws;
      ws.onopen = () => setOnline(true);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "error" && ["auth", "not_found", "Room is full", "Game already started"].includes(msg.detail)) alive = false;
        handler.current(msg);
      };
      ws.onclose = () => {
        setOnline(false);
        if (alive) timer = setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      alive = false;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [code]);

  const send = (msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  };
  return { send, online };
}

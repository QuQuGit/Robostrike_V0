import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { MessageSquare, Send } from "lucide-react";

export function ChatPanel({ chat, onSend, className = "" }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const listRef = useRef(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chat]);
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <div className={`rs-steel rounded-md p-2 flex flex-col ${className}`} data-testid="chat-panel">
      <h3 className="font-title text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-1 flex items-center gap-1.5">
        <MessageSquare size={11} /> {t("room.chat")}
      </h3>
      <div ref={listRef} className="rs-screen rounded p-1.5 space-y-0.5 overflow-y-auto font-mono-rs text-[11px] h-28 lg:h-auto lg:flex-1 lg:min-h-[90px]" data-testid="chat-messages">
        {chat.map((m, i) => (
          <p key={i} className="text-zinc-300 break-words">
            <span className="font-bold" style={{ color: m.color || "#ff9a1f" }}>{m.user}</span> {m.text}
          </p>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-1 mt-1.5">
        <input data-testid="chat-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={200}
          placeholder={t("room.say")} className="rs-select flex-1 min-w-0 text-xs" />
        <button data-testid="chat-send" type="submit" className="rs-icon-btn" title={t("room.send")}><Send size={14} /></button>
      </form>
    </div>
  );
}

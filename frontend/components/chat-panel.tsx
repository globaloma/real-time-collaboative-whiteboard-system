"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/lib/types";

type Props = {
  messages: ChatMessage[];
  selfSid: string | null;
  onSendMessage: (message: string) => void;
  disabled?: boolean;
};

export function ChatPanel({ messages, selfSid, onSendMessage, disabled }: Props) {
  const [value, setValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = value.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setValue("");
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No messages yet — say hello.</p>
        ) : (
          messages.map((message) => {
            const isMe = message.sid === selfSid;

            return (
              <div key={message.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl border px-3 py-2 text-sm shadow-sm ${
                    isMe
                      ? "border-brand-500/30 bg-brand-500/15 text-slate-100"
                      : "border-white/10 bg-white/[0.04] text-slate-100"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: message.color }}
                    />
                    <span className="text-xs font-medium text-slate-300">
                      {message.username}
                      {isMe ? " (you)" : ""}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words leading-snug">{message.message}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="flex gap-2 border-t border-white/[0.08] p-3" onSubmit={handleSubmit}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={disabled ? "Connecting..." : "Type a message"}
          disabled={disabled}
          maxLength={300}
        />
        <Button type="submit" size="icon" disabled={disabled || !value.trim()} aria-label="Send message">
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

"use client";

import { Activity, MessagesSquare, StickyNote as StickyNoteIcon, Users, X } from "lucide-react";
import { ChatPanel } from "@/components/chat-panel";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { IconTooltip } from "@/components/ui/tooltip";
import {
  BoardHistoryState,
  ChatMessage,
  PersistenceState,
  RoomUser,
  StickyNote
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type PanelKey = "users" | "chat" | "notes" | "activity";

type Props = {
  activePanel: PanelKey | null;
  onActivePanelChange: (panel: PanelKey | null) => void;
  users: RoomUser[];
  selfSid: string | null;
  messages: ChatMessage[];
  unreadCount: number;
  onSendMessage: (message: string) => void;
  isReady: boolean;
  stickyNotes: StickyNote[];
  newNoteText: string;
  onNewNoteTextChange: (text: string) => void;
  newNoteColor: string;
  onNewNoteColorChange: (color: string) => void;
  onAddStickyNote: () => void;
  strokeCount: number;
  historyState: BoardHistoryState;
  persistenceState: PersistenceState;
};

const RAIL_ITEMS: { key: PanelKey; label: string; icon: typeof Users }[] = [
  { key: "users", label: "People", icon: Users },
  { key: "chat", label: "Chat", icon: MessagesSquare },
  { key: "notes", label: "Sticky notes", icon: StickyNoteIcon },
  { key: "activity", label: "Activity", icon: Activity }
];

export function BoardSidePanel(props: Props) {
  const { activePanel, onActivePanelChange } = props;

  return (
    <div className="flex h-full shrink-0">
      {activePanel ? (
        <div className="flex w-[320px] flex-col border-l border-white/[0.08] bg-surface-panel/95 backdrop-blur animate-slide-up sm:w-[340px]">
          <PanelContent {...props} />
        </div>
      ) : null}

      <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-l border-white/[0.08] bg-surface-panel/60 py-3">
        {RAIL_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = activePanel === key;
          const badgeCount =
            key === "chat" ? props.unreadCount : key === "notes" ? props.stickyNotes.length : 0;

          return (
            <IconTooltip key={key} label={label}>
              <button
                type="button"
                onClick={() => onActivePanelChange(isActive ? null : key)}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                  isActive
                    ? "bg-brand-500 text-white"
                    : "text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
                )}
                aria-label={label}
                aria-pressed={isActive}
              >
                <Icon className="h-5 w-5" />
                {badgeCount > 0 && !isActive ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                ) : null}
              </button>
            </IconTooltip>
          );
        })}
      </div>
    </div>
  );
}

function PanelContent(props: Props) {
  switch (props.activePanel) {
    case "users":
      return <UsersPanel {...props} />;
    case "chat":
      return <ChatPanelPane {...props} />;
    case "notes":
      return <NotesPanel {...props} />;
    case "activity":
      return <ActivityPanel {...props} />;
    default:
      return null;
  }
}

function PanelHeader({
  title,
  onClose
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close panel">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function UsersPanel({ users, selfSid, onActivePanelChange }: Props) {
  return (
    <>
      <PanelHeader title={`People · ${users.length}`} onClose={() => onActivePanelChange(null)} />
      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {users.length === 0 ? (
          <p className="px-2 py-4 text-sm text-slate-500">No one else is here yet.</p>
        ) : (
          users.map((user) => {
            const isMe = user.sid === selfSid;
            return (
              <div
                key={user.sid}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]"
              >
                <Avatar name={user.username} color={user.color} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {user.username} {isMe ? <span className="text-slate-500">(you)</span> : null}
                  </p>
                  <p className="truncate text-xs text-slate-500">{user.sid.slice(0, 8)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function ChatPanelPane({
  messages,
  selfSid,
  onSendMessage,
  isReady,
  onActivePanelChange
}: Props) {
  return (
    <>
      <PanelHeader title="Chat" onClose={() => onActivePanelChange(null)} />
      <ChatPanel
        messages={messages}
        selfSid={selfSid}
        onSendMessage={onSendMessage}
        disabled={!isReady}
      />
    </>
  );
}

function NotesPanel({
  newNoteText,
  onNewNoteTextChange,
  newNoteColor,
  onNewNoteColorChange,
  onAddStickyNote,
  isReady,
  stickyNotes,
  onActivePanelChange
}: Props) {
  return (
    <>
      <PanelHeader title={`Sticky notes · ${stickyNotes.length}`} onClose={() => onActivePanelChange(null)} />
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <Label htmlFor="new-note-text">New idea</Label>
          <textarea
            id="new-note-text"
            value={newNoteText}
            onChange={(e) => onNewNoteTextChange(e.target.value)}
            placeholder="Write an idea..."
            maxLength={500}
            className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
            disabled={!isReady}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="space-y-2">
            <Label>Color</Label>
            <input
              type="color"
              value={newNoteColor}
              onChange={(e) => onNewNoteColorChange(e.target.value)}
              className="h-9 w-16 cursor-pointer rounded-md border border-white/10 bg-transparent p-1"
              disabled={!isReady}
            />
          </div>

          <Button className="mt-6 flex-1" onClick={onAddStickyNote} disabled={!isReady}>
            Add note
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          Drag notes by the header on the board. Double-click a note to edit its text.
        </p>
      </div>
    </>
  );
}

function ActivityPanel({
  strokeCount,
  stickyNotes,
  historyState,
  persistenceState,
  onActivePanelChange
}: Props) {
  return (
    <>
      <PanelHeader title="Activity" onClose={() => onActivePanelChange(null)} />
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        <Stat label="Strokes on board" value={strokeCount} />
        <Stat label="Sticky notes" value={stickyNotes.length} />
        <Stat
          label="History position"
          value={`${historyState.historyIndex + 1} / ${historyState.historyLength}`}
        />
        <Separator />
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Persistence</p>
          <p className="text-sm text-slate-200">
            {persistenceState.enabled ? "Firebase autosave enabled" : "Local session only"}
          </p>
          {persistenceState.lastError ? (
            <p className="text-xs text-rose-400">{persistenceState.lastError}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-100">{value}</span>
    </div>
  );
}

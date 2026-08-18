"use client";

import { ChevronLeft, Cloud, CloudOff, Link2, Loader2, PenTool } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/ui/tooltip";
import { PersistenceState, RoomUser, SocketStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  roomId: string;
  connectionStatus: SocketStatus;
  users: RoomUser[];
  selfSid: string | null;
  persistenceState: PersistenceState;
  savingBoard: boolean;
  isReady: boolean;
  onBack: () => void;
  onSave: () => void;
  onCopyLink: () => void;
};

const STATUS_COPY: Record<SocketStatus, { label: string; dot: string }> = {
  connected: { label: "Live", dot: "bg-emerald-400" },
  connecting: { label: "Connecting", dot: "bg-amber-400 animate-pulse" },
  disconnected: { label: "Disconnected", dot: "bg-slate-500" },
  error: { label: "Connection error", dot: "bg-rose-400" }
};

export function BoardTopbar({
  roomId,
  connectionStatus,
  users,
  selfSid,
  persistenceState,
  savingBoard,
  isReady,
  onBack,
  onSave,
  onCopyLink
}: Props) {
  const status = STATUS_COPY[connectionStatus];
  const visibleUsers = users.slice(0, 5);
  const overflowCount = users.length - visibleUsers.length;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-surface-panel/80 px-3 backdrop-blur sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <IconTooltip label="Back to home">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to home">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </IconTooltip>

        <div className="hidden items-center gap-1.5 sm:flex">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-500">
            <PenTool className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Boardly</span>
        </div>

        <span className="hidden h-4 w-px bg-white/10 sm:block" />

        <button
          type="button"
          onClick={onCopyLink}
          className="group flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-slate-300 transition-colors hover:bg-white/[0.06]"
        >
          <span className="truncate max-w-[8rem] sm:max-w-none">{roomId}</span>
          <Link2 className="h-3 w-3 shrink-0 text-slate-500 transition-colors group-hover:text-slate-300" />
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Badge variant="default" className="hidden gap-1.5 sm:inline-flex">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </Badge>

        {visibleUsers.length > 0 ? (
          <div className="hidden items-center -space-x-2 sm:flex">
            {visibleUsers.map((user) => (
              <Avatar
                key={user.sid}
                name={user.sid === selfSid ? `${user.username} (you)` : user.username}
                color={user.color}
                size="sm"
              />
            ))}
            {overflowCount > 0 ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-slate-300 ring-2 ring-surface-panel">
                +{overflowCount}
              </div>
            ) : null}
          </div>
        ) : null}

        <IconTooltip label={persistenceState.enabled ? "Save board" : "Persistence disabled"}>
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={!isReady || !persistenceState.enabled || savingBoard}
          >
            {savingBoard ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : persistenceState.enabled ? (
              <Cloud className="h-3.5 w-3.5" />
            ) : (
              <CloudOff className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{savingBoard ? "Saving" : "Save"}</span>
          </Button>
        </IconTooltip>
      </div>
    </header>
  );
}

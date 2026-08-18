"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BoardSidePanel, PanelKey } from "@/components/board-side-panel";
import { BoardTopbar } from "@/components/board-topbar";
import { LiveCursorLayer } from "@/components/live-cursor-layer";
import { StickyNoteCard } from "@/components/sticky-note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WhiteboardCanvas } from "@/components/whiteboard-canvas";
import { WhiteboardToolbar } from "@/components/whiteboard-toolbar";
import { useWhiteboardRoom } from "@/hooks/use-whiteboard-room";
import { saveRecentRoom } from "@/lib/recent-rooms";
import { BoardStroke, StickyNote, Tool } from "@/lib/types";

type Props = {
  roomId: string;
  username: string;
};

type PendingDelete = { kind: "note"; id: string } | { kind: "board" } | null;

export function BoardWorkspace({ roomId, username }: Props) {
  const router = useRouter();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const activeStrokeIdRef = useRef<string | null>(null);

  const cleanRoomId = useMemo(() => roomId.trim() || "DEMO-ROOM", [roomId]);
  const cleanUsername = useMemo(() => username.trim() || "Guest", [username]);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#111827");
  const [size, setSize] = useState(6);

  const [newNoteText, setNewNoteText] = useState("New idea");
  const [newNoteColor, setNewNoteColor] = useState("#fde68a");

  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const previousMessageCountRef = useRef(0);

  const handleServerError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const {
    users,
    strokes,
    cursors,
    messages,
    stickyNotes,
    historyState,
    persistenceState,
    selfSid,
    connectionStatus,
    isReady,
    savingBoard,
    startStroke,
    moveStroke,
    endStroke,
    clearCanvas,
    sendCursor,
    sendMessage,
    createStickyNote,
    updateStickyNote,
    moveStickyNote,
    deleteStickyNote,
    undoBoard,
    redoBoard,
    saveBoard
  } = useWhiteboardRoom({
    roomId: cleanRoomId,
    username: cleanUsername,
    onServerError: handleServerError
  });

  useEffect(() => {
    const node = boardRef.current;
    if (!node) return;

    const update = () => setBoardSize({ width: node.clientWidth, height: node.clientHeight });
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isReady) {
      saveRecentRoom(cleanRoomId, cleanUsername);
    }
  }, [isReady, cleanRoomId, cleanUsername]);

  useEffect(() => {
    const delta = messages.length - previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    // Deliberate effect, not derived render state: it tracks how many chat
    // messages have arrived since the panel was last open, which requires
    // remembering a value across renders that isn't itself a prop or state.
    if (activePanel === "chat") {
      setUnreadCount(0);
    } else if (delta > 0) {
      setUnreadCount((prev) => prev + delta);
    }
  }, [activePanel, messages.length]);

  const savingRef = useRef(false);
  useEffect(() => {
    if (savingBoard) {
      savingRef.current = true;
      return;
    }
    if (savingRef.current) {
      savingRef.current = false;
      if (persistenceState.lastError) {
        toast.error(persistenceState.lastError);
      } else {
        toast.success("Board saved");
      }
    }
  }, [savingBoard, persistenceState.lastError]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,[contenteditable=true]")) return;
      if (!isReady) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoBoard();
        else undoBoard();
        return;
      }

      if (event.key.toLowerCase() === "p") setTool("pen");
      if (event.key.toLowerCase() === "e") setTool("eraser");
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isReady, undoBoard, redoBoard]);

  const handlePointerDown = (point: { x: number; y: number }) => {
    if (!isReady) return;

    const stroke: BoardStroke = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      tool,
      color,
      size,
      points: [point],
      finished: false,
      createdAt: Date.now()
    };

    activeStrokeIdRef.current = stroke.id;
    startStroke(stroke);
    sendCursor(point);
  };

  const handlePointerMove = (point: { x: number; y: number }) => {
    if (!isReady) return;

    sendCursor(point);

    const strokeId = activeStrokeIdRef.current;
    if (!strokeId) return;

    moveStroke(strokeId, point);
  };

  const handlePointerUp = () => {
    if (!isReady) return;

    const strokeId = activeStrokeIdRef.current;
    if (!strokeId) return;

    endStroke(strokeId);
    activeStrokeIdRef.current = null;
  };

  const handleClear = () => {
    if (!isReady) return;
    setPendingDelete({ kind: "board" });
  };

  const handleUndo = () => {
    if (!isReady) return;
    activeStrokeIdRef.current = null;
    undoBoard();
  };

  const handleRedo = () => {
    if (!isReady) return;
    activeStrokeIdRef.current = null;
    redoBoard();
  };

  const copyRoomLink = async () => {
    const url = `${window.location.origin}/board?room=${encodeURIComponent(cleanRoomId)}`;

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Room link copied to clipboard");
    } catch {
      toast.message("Copy this room link", { description: url });
    }
  };

  const handleAddStickyNote = () => {
    if (!isReady) return;

    const width = boardSize.width || 1;
    const height = boardSize.height || 1;
    const x = Math.max(0, width / 2 - 110) / width;
    const y = Math.max(0, height / 2 - 100) / width;

    const note: StickyNote = {
      id: crypto.randomUUID(),
      sid: selfSid ?? "",
      username: cleanUsername,
      text: newNoteText.trim() || "New idea",
      color: newNoteColor,
      x,
      y,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    createStickyNote(note);
    setNewNoteText("");
  };

  const handleConfirmClearBoard = () => {
    activeStrokeIdRef.current = null;
    clearCanvas();
  };

  const handleConfirmDeleteNote = () => {
    if (pendingDelete?.kind === "note") {
      deleteStickyNote(pendingDelete.id);
    }
  };

  const confirmDialogProps =
    pendingDelete?.kind === "board"
      ? {
          title: "Clear the entire board?",
          description:
            "This removes every drawing and sticky note for everyone in this room. This can be undone with Undo immediately after.",
          confirmLabel: "Clear board",
          onConfirm: handleConfirmClearBoard
        }
      : pendingDelete?.kind === "note"
      ? {
          title: "Delete this sticky note?",
          description: "This note will be removed for everyone in the room.",
          confirmLabel: "Delete note",
          onConfirm: handleConfirmDeleteNote
        }
      : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      <BoardTopbar
        roomId={cleanRoomId}
        connectionStatus={connectionStatus}
        users={users}
        selfSid={selfSid}
        persistenceState={persistenceState}
        savingBoard={savingBoard}
        isReady={isReady}
        onBack={() => router.push("/")}
        onSave={saveBoard}
        onCopyLink={copyRoomLink}
      />

      <div className="relative flex flex-1 overflow-hidden">
        <main className="relative flex-1 overflow-hidden p-3 sm:p-4">
          <div ref={boardRef} className="relative h-full w-full">
            {!isReady ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[1.75rem] bg-surface/80 backdrop-blur-sm">
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">
                    {connectionStatus === "error"
                      ? "Connection error"
                      : connectionStatus === "disconnected"
                      ? "Disconnected"
                      : "Connecting to room..."}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Please wait while we sync the board state.
                  </p>
                </div>
              </div>
            ) : null}

            <WhiteboardCanvas
              strokes={strokes}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={!isReady ? "pointer-events-none" : undefined}
            />

            <div className="pointer-events-none absolute inset-0 z-10">
              {boardSize.width > 0
                ? stickyNotes.map((note) => (
                    <div key={note.id} className="pointer-events-auto">
                      <StickyNoteCard
                        note={note}
                        boardRef={boardRef}
                        boardSize={boardSize}
                        disabled={!isReady}
                        onMove={moveStickyNote}
                        onUpdate={updateStickyNote}
                        onRequestDelete={(noteId) => setPendingDelete({ kind: "note", id: noteId })}
                      />
                    </div>
                  ))
                : null}
            </div>

            <LiveCursorLayer cursors={cursors} selfSid={selfSid} boardSize={boardSize} />

            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:bottom-6">
              <div className="pointer-events-auto">
                <WhiteboardToolbar
                  tool={tool}
                  color={color}
                  size={size}
                  onToolChange={setTool}
                  onColorChange={setColor}
                  onSizeChange={setSize}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onClear={handleClear}
                  canUndo={historyState.canUndo}
                  canRedo={historyState.canRedo}
                  disabled={!isReady}
                />
              </div>
            </div>
          </div>
        </main>

        <BoardSidePanel
          activePanel={activePanel}
          onActivePanelChange={setActivePanel}
          users={users}
          selfSid={selfSid}
          messages={messages}
          unreadCount={unreadCount}
          onSendMessage={sendMessage}
          isReady={isReady}
          stickyNotes={stickyNotes}
          newNoteText={newNoteText}
          onNewNoteTextChange={setNewNoteText}
          newNoteColor={newNoteColor}
          onNewNoteColorChange={setNewNoteColor}
          onAddStickyNote={handleAddStickyNote}
          strokeCount={strokes.length}
          historyState={historyState}
          persistenceState={persistenceState}
        />
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={confirmDialogProps?.title ?? ""}
        description={confirmDialogProps?.description ?? ""}
        confirmLabel={confirmDialogProps?.confirmLabel}
        onConfirm={() => confirmDialogProps?.onConfirm()}
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GripHorizontal, Trash2 } from "lucide-react";
import { StickyNote } from "@/lib/types";
import { cn } from "@/lib/utils";

type BoardSize = { width: number; height: number };

type Props = {
  note: StickyNote;
  boardRef: React.RefObject<HTMLDivElement | null>;
  boardSize: BoardSize;
  disabled?: boolean;
  onMove: (noteId: string, x: number, y: number) => void;
  onUpdate: (noteId: string, patch: Partial<StickyNote>) => void;
  onRequestDelete: (noteId: string) => void;
};

const NOTE_WIDTH = 220;
const NOTE_HEIGHT = 200;
const EDGE_PADDING = 8;

export function StickyNoteCard({
  note,
  boardRef,
  boardSize,
  disabled,
  onMove,
  onUpdate,
  onRequestDelete
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(note.text);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const dragStateRef = useRef<{
    dragging: boolean;
    offsetX: number;
    offsetY: number;
    lastXFraction: number;
    lastYFraction: number;
    moveListener?: (event: PointerEvent) => void;
    upListener?: (event: PointerEvent) => void;
  }>({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
    lastXFraction: note.x,
    lastYFraction: note.y
  });

  const canInteract = !disabled;

  const beginEditing = () => {
    if (!canInteract) return;
    setDraftText(note.text);
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [isEditing]);

  const cleanupDragListeners = () => {
    const state = dragStateRef.current;
    if (state.moveListener) {
      window.removeEventListener("pointermove", state.moveListener);
    }
    if (state.upListener) {
      window.removeEventListener("pointerup", state.upListener);
    }

    dragStateRef.current = {
      dragging: false,
      offsetX: 0,
      offsetY: 0,
      lastXFraction: note.x,
      lastYFraction: note.y
    };
  };

  useEffect(() => {
    return () => cleanupDragListeners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canInteract || isEditing) return;

    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea")) return;

    const board = boardRef.current;
    if (!board) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = board.getBoundingClientRect();
    const noteLeft = note.x * rect.width;
    const noteTop = note.y * rect.width;

    dragStateRef.current.dragging = true;
    dragStateRef.current.offsetX = event.clientX - rect.left - noteLeft;
    dragStateRef.current.offsetY = event.clientY - rect.top - noteTop;
    dragStateRef.current.lastXFraction = note.x;
    dragStateRef.current.lastYFraction = note.y;

    const handleMove = (moveEvent: PointerEvent) => {
      if (!dragStateRef.current.dragging) return;

      const latestBoard = boardRef.current;
      if (!latestBoard) return;

      const latestRect = latestBoard.getBoundingClientRect();
      if (latestRect.width === 0 || latestRect.height === 0) return;

      let nextX = moveEvent.clientX - latestRect.left - dragStateRef.current.offsetX;
      let nextY = moveEvent.clientY - latestRect.top - dragStateRef.current.offsetY;

      const maxX = Math.max(EDGE_PADDING, latestRect.width - NOTE_WIDTH - EDGE_PADDING);
      const maxY = Math.max(EDGE_PADDING, latestRect.height - NOTE_HEIGHT - EDGE_PADDING);

      nextX = Math.min(Math.max(EDGE_PADDING, nextX), maxX);
      nextY = Math.min(Math.max(EDGE_PADDING, nextY), maxY);

      const xFraction = nextX / latestRect.width;
      const yFraction = nextY / latestRect.width;

      dragStateRef.current.lastXFraction = xFraction;
      dragStateRef.current.lastYFraction = yFraction;

      onMove(note.id, xFraction, yFraction);
    };

    const handleUp = () => {
      if (dragStateRef.current.dragging) {
        onUpdate(note.id, {
          x: dragStateRef.current.lastXFraction,
          y: dragStateRef.current.lastYFraction
        });
      }
      cleanupDragListeners();
    };

    dragStateRef.current.moveListener = handleMove;
    dragStateRef.current.upListener = handleUp;

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const commitText = () => {
    const nextText = draftText.trim() || "New idea";
    if (nextText !== note.text) {
      onUpdate(note.id, { text: nextText });
    }
    setIsEditing(false);
  };

  const handleColorChange = (color: string) => {
    onUpdate(note.id, { color });
  };

  const pixelPosition = useMemo(() => {
    if (boardSize.width === 0) return null;
    return {
      left: note.x * boardSize.width,
      top: note.y * boardSize.width
    };
  }, [note.x, note.y, boardSize.width]);

  if (!pixelPosition) return null;

  return (
    <div
      className={cn(
        "absolute overflow-hidden rounded-xl border border-black/10 shadow-xl transition-shadow",
        "select-none touch-none text-slate-900",
        canInteract ? "cursor-grab hover:shadow-2xl active:cursor-grabbing" : "opacity-75"
      )}
      style={{
        left: pixelPosition.left,
        top: pixelPosition.top,
        width: NOTE_WIDTH,
        backgroundColor: note.color
      }}
      onPointerDown={startDrag}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/10 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5 text-black/40">
          <GripHorizontal className="h-3.5 w-3.5 shrink-0" />
          <p className="truncate text-[11px] font-semibold text-slate-900/70">{note.username}</p>
        </div>

        <div className="flex items-center gap-1">
          <input
            type="color"
            value={note.color}
            onChange={(e) => handleColorChange(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border border-black/10 bg-transparent p-0"
            aria-label="Note color"
            disabled={!canInteract}
            onPointerDown={(e) => e.stopPropagation()}
          />

          <button
            type="button"
            onClick={() => onRequestDelete(note.id)}
            disabled={!canInteract}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-900/50 transition-colors hover:bg-black/10 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Delete note"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraftText(note.text);
                setIsEditing(false);
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                commitText();
              }
            }}
            disabled={!canInteract}
            maxLength={500}
            className="min-h-[100px] w-full resize-none rounded-lg border border-black/10 bg-white/40 p-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-black/10"
            placeholder="Write an idea..."
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            role="button"
            tabIndex={0}
            onDoubleClick={beginEditing}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                beginEditing();
              }
            }}
            className="min-h-[100px] whitespace-pre-wrap break-words rounded-lg bg-white/30 p-2.5 text-sm leading-5 text-slate-900 outline-none"
            title="Double click to edit"
          >
            {note.text}
          </div>
        )}
      </div>
    </div>
  );
}

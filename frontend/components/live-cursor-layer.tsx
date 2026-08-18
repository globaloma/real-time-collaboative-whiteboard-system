"use client";

import { MousePointer2 } from "lucide-react";
import { RoomCursor } from "@/lib/types";

type BoardSize = { width: number; height: number };

type Props = {
  cursors: RoomCursor[];
  selfSid: string | null;
  boardSize: BoardSize;
};

export function LiveCursorLayer({ cursors, selfSid, boardSize }: Props) {
  const visibleCursors = cursors.filter((cursor) => cursor.sid !== selfSid);

  if (visibleCursors.length === 0 || boardSize.width === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {visibleCursors.map((cursor) => (
        <div
          key={cursor.sid}
          className="absolute select-none transition-[left,top] duration-75 ease-linear"
          style={{ left: cursor.x * boardSize.width, top: cursor.y * boardSize.width }}
        >
          <MousePointer2
            className="h-5 w-5 -translate-x-0.5 -translate-y-0.5 drop-shadow-md"
            style={{ color: cursor.color }}
            fill={cursor.color}
          />
          <span
            className="ml-3 mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-lg"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.username}
          </span>
        </div>
      ))}
    </div>
  );
}

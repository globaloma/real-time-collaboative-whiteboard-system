"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  BoardHistoryState,
  BoardSavedPayload,
  BoardStateSyncPayload,
  BoardStroke,
  ChatMessage,
  PersistenceState,
  Point,
  RoomCursor,
  RoomJoinedPayload,
  RoomUser,
  SocketStatus,
  StickyNote,
  Tool
} from "@/lib/types";
import { createWhiteboardSocket } from "@/socket/whiteboard-socket";

type UseWhiteboardRoomParams = {
  roomId: string;
  username: string;
  onServerError?: (message: string) => void;
};

const EMPTY_HISTORY_STATE: BoardHistoryState = {
  canUndo: false,
  canRedo: false,
  historyIndex: 0,
  historyLength: 1
};

const EMPTY_PERSISTENCE_STATE: PersistenceState = {
  enabled: false,
  hasPersistedData: false,
  lastSavedAt: null,
  lastError: null
};

function upsertStroke(strokes: BoardStroke[], stroke: BoardStroke) {
  const existingIndex = strokes.findIndex((s) => s.id === stroke.id);

  if (existingIndex === -1) {
    return [...strokes, stroke];
  }

  const next = [...strokes];
  next[existingIndex] = stroke;
  return next;
}

function appendPointToStroke(strokes: BoardStroke[], strokeId: string, point: Point) {
  const existingIndex = strokes.findIndex((s) => s.id === strokeId);

  if (existingIndex === -1) {
    return [
      ...strokes,
      {
        id: strokeId,
        username: "Unknown",
        tool: "pen" as Tool,
        color: "#111827",
        size: 4,
        points: [point],
        finished: false,
        createdAt: Date.now()
      }
    ];
  }

  const next = [...strokes];
  const stroke = next[existingIndex];
  next[existingIndex] = {
    ...stroke,
    points: [...stroke.points, point]
  };

  return next;
}

function finishStroke(strokes: BoardStroke[], strokeId: string) {
  const existingIndex = strokes.findIndex((s) => s.id === strokeId);

  if (existingIndex === -1) return strokes;

  const next = [...strokes];
  next[existingIndex] = {
    ...next[existingIndex],
    finished: true
  };

  return next;
}

function upsertCursor(cursors: RoomCursor[], cursor: RoomCursor) {
  const existingIndex = cursors.findIndex((c) => c.sid === cursor.sid);

  if (existingIndex === -1) {
    return [...cursors, cursor];
  }

  const next = [...cursors];
  next[existingIndex] = cursor;
  return next;
}

function appendMessage(messages: ChatMessage[], message: ChatMessage) {
  return [...messages.slice(-99), message];
}

function upsertStickyNote(notes: StickyNote[], note: StickyNote) {
  const existingIndex = notes.findIndex((n) => n.id === note.id);

  if (existingIndex === -1) {
    return [...notes, note];
  }

  const next = [...notes];
  next[existingIndex] = note;
  return next;
}

function removeStickyNote(notes: StickyNote[], noteId: string) {
  return notes.filter((note) => note.id !== noteId);
}

export function useWhiteboardRoom({ roomId, username, onServerError }: UseWhiteboardRoomParams) {
  const socketRef = useRef<Socket | null>(null);
  const lastCursorEmitRef = useRef(0);
  const stickyNotesRef = useRef<StickyNote[]>([]);
  const isReadyRef = useRef(false);
  const onServerErrorRef = useRef(onServerError);
  onServerErrorRef.current = onServerError;

  const [users, setUsers] = useState<RoomUser[]>([]);
  const [strokes, setStrokes] = useState<BoardStroke[]>([]);
  const [cursors, setCursors] = useState<RoomCursor[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [historyState, setHistoryState] = useState<BoardHistoryState>(EMPTY_HISTORY_STATE);
  const [persistenceState, setPersistenceState] = useState<PersistenceState>(
    EMPTY_PERSISTENCE_STATE
  );
  const [connectionStatus, setConnectionStatus] = useState<SocketStatus>("connecting");
  const [isReady, setIsReady] = useState(false);
  const [savingBoard, setSavingBoard] = useState(false);
  const [selfSid, setSelfSid] = useState<string | null>(null);

  const activeRoomId = roomId.trim();
  const activeUsername = username.trim() || "Guest";

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  const replaceStickyNotes = useCallback((next: StickyNote[]) => {
    stickyNotesRef.current = next;
    setStickyNotes(next);
  }, []);

  const replaceBoardSnapshot = useCallback(
    (payload: BoardStateSyncPayload) => {
      setStrokes(payload.boardState ?? []);
      replaceStickyNotes(payload.stickyNotes ?? []);
      setHistoryState(payload.historyState ?? EMPTY_HISTORY_STATE);
    },
    [replaceStickyNotes]
  );

  useEffect(() => {
    if (!activeRoomId) return;

    const socket = createWhiteboardSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setConnectionStatus("connected");
      setIsReady(false);

      socket.emit("join_room", {
        roomId: activeRoomId,
        username: activeUsername
      });
    };

    const handleDisconnect = () => {
      setConnectionStatus("disconnected");
      setIsReady(false);
      setSavingBoard(false);
      setUsers([]);
      setSelfSid(null);
    };

    const handleConnectError = () => {
      setConnectionStatus("error");
      setIsReady(false);
      setSavingBoard(false);
    };

    const handleRoomJoined = (payload: RoomJoinedPayload) => {
      setSelfSid(payload.sid);
      setUsers(payload.users ?? []);
      setStrokes(payload.boardState ?? []);
      setCursors(payload.cursors ?? []);
      setMessages(payload.messages ?? []);
      replaceStickyNotes(payload.stickyNotes ?? []);
      setHistoryState(payload.historyState ?? EMPTY_HISTORY_STATE);
      setPersistenceState(payload.persistence ?? EMPTY_PERSISTENCE_STATE);
      setConnectionStatus("connected");
      setIsReady(true);
      setSavingBoard(false);
    };

    const handleRoomUsers = (payload: { roomId: string; users: RoomUser[] }) => {
      setUsers(payload.users ?? []);
    };

    const handleDrawStart = (payload: { roomId: string; stroke: BoardStroke }) => {
      setStrokes((prev) => upsertStroke(prev, payload.stroke));
    };

    const handleDrawMove = (payload: { roomId: string; strokeId: string; point: Point }) => {
      setStrokes((prev) => appendPointToStroke(prev, payload.strokeId, payload.point));
    };

    const handleDrawEnd = (payload: { roomId: string; strokeId: string }) => {
      setStrokes((prev) => finishStroke(prev, payload.strokeId));
    };

    const handleClearCanvas = () => {
      setStrokes([]);
      replaceStickyNotes([]);
    };

    const handleCursorMove = (payload: { roomId: string; cursor: RoomCursor }) => {
      setCursors((prev) => upsertCursor(prev, payload.cursor));
    };

    const handleCursorRemove = (payload: { roomId: string; sid: string }) => {
      setCursors((prev) => prev.filter((cursor) => cursor.sid !== payload.sid));
    };

    const handleChatMessage = (payload: { roomId: string; message: ChatMessage }) => {
      setMessages((prev) => appendMessage(prev, payload.message));
    };

    const handleStickyNoteUpsert = (payload: { roomId: string; note: StickyNote }) => {
      replaceStickyNotes(upsertStickyNote(stickyNotesRef.current, payload.note));
    };

    const handleStickyNoteDelete = (payload: { roomId: string; noteId: string }) => {
      replaceStickyNotes(removeStickyNote(stickyNotesRef.current, payload.noteId));
    };

    const handleBoardStateSync = (payload: BoardStateSyncPayload) => {
      replaceBoardSnapshot(payload);
    };

    const handleBoardHistoryState = (payload: {
      roomId: string;
      historyState: BoardHistoryState;
    }) => {
      setHistoryState(payload.historyState ?? EMPTY_HISTORY_STATE);
    };

    const handleBoardSaved = (payload: BoardSavedPayload) => {
      setSavingBoard(false);
      setPersistenceState(payload.persistence ?? EMPTY_PERSISTENCE_STATE);
    };

    const handleServerError = (payload: { message: string }) => {
      onServerErrorRef.current?.(payload.message);

      // Only treat this as a fatal connection error if it happened before we
      // ever successfully joined the room — transient warnings (rate limits,
      // board size limits, etc.) shouldn't kick the user out of a live board.
      if (!isReadyRef.current) {
        setConnectionStatus("error");
        setSavingBoard(false);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("room_joined", handleRoomJoined);
    socket.on("room_users", handleRoomUsers);
    socket.on("draw_start", handleDrawStart);
    socket.on("draw_move", handleDrawMove);
    socket.on("draw_end", handleDrawEnd);
    socket.on("clear_canvas", handleClearCanvas);
    socket.on("cursor_move", handleCursorMove);
    socket.on("cursor_remove", handleCursorRemove);
    socket.on("chat_message", handleChatMessage);
    socket.on("sticky_note_upsert", handleStickyNoteUpsert);
    socket.on("sticky_note_delete", handleStickyNoteDelete);
    socket.on("board_state_sync", handleBoardStateSync);
    socket.on("board_history_state", handleBoardHistoryState);
    socket.on("board_saved", handleBoardSaved);
    socket.on("server_error", handleServerError);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("room_joined", handleRoomJoined);
      socket.off("room_users", handleRoomUsers);
      socket.off("draw_start", handleDrawStart);
      socket.off("draw_move", handleDrawMove);
      socket.off("draw_end", handleDrawEnd);
      socket.off("clear_canvas", handleClearCanvas);
      socket.off("cursor_move", handleCursorMove);
      socket.off("cursor_remove", handleCursorRemove);
      socket.off("chat_message", handleChatMessage);
      socket.off("sticky_note_upsert", handleStickyNoteUpsert);
      socket.off("sticky_note_delete", handleStickyNoteDelete);
      socket.off("board_state_sync", handleBoardStateSync);
      socket.off("board_history_state", handleBoardHistoryState);
      socket.off("board_saved", handleBoardSaved);
      socket.off("server_error", handleServerError);

      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [activeRoomId, activeUsername, replaceBoardSnapshot, replaceStickyNotes]);

  const startStroke = useCallback(
    (stroke: BoardStroke) => {
      setStrokes((prev) => upsertStroke(prev, stroke));
      socketRef.current?.emit("draw_start", {
        roomId: activeRoomId,
        stroke
      });
    },
    [activeRoomId]
  );

  const moveStroke = useCallback(
    (strokeId: string, point: Point) => {
      setStrokes((prev) => appendPointToStroke(prev, strokeId, point));
      socketRef.current?.volatile.emit("draw_move", {
        roomId: activeRoomId,
        strokeId,
        point
      });
    },
    [activeRoomId]
  );

  const endStroke = useCallback(
    (strokeId: string) => {
      setStrokes((prev) => finishStroke(prev, strokeId));
      socketRef.current?.emit("draw_end", {
        roomId: activeRoomId,
        strokeId
      });
    },
    [activeRoomId]
  );

  const clearCanvas = useCallback(() => {
    setStrokes([]);
    replaceStickyNotes([]);
    socketRef.current?.emit("clear_canvas", {
      roomId: activeRoomId
    });
  }, [activeRoomId, replaceStickyNotes]);

  const sendCursor = useCallback(
    (point: Point) => {
      if (!isReady) return;

      const now = Date.now();
      if (now - lastCursorEmitRef.current < 20) return;

      lastCursorEmitRef.current = now;

      socketRef.current?.volatile.emit("cursor_move", {
        roomId: activeRoomId,
        point
      });
    },
    [activeRoomId, isReady]
  );

  const sendMessage = useCallback(
    (message: string) => {
      if (!isReady) return;

      const trimmed = message.trim();
      if (!trimmed) return;

      socketRef.current?.emit("chat_message", {
        roomId: activeRoomId,
        message: trimmed
      });
    },
    [activeRoomId, isReady]
  );

  const createStickyNote = useCallback(
    (note: StickyNote) => {
      const nextNotes = upsertStickyNote(stickyNotesRef.current, note);
      replaceStickyNotes(nextNotes);

      socketRef.current?.emit("sticky_note_upsert", {
        roomId: activeRoomId,
        action: "create",
        note
      });
    },
    [activeRoomId, replaceStickyNotes]
  );

  const updateStickyNote = useCallback(
    (noteId: string, patch: Partial<StickyNote>) => {
      const current = stickyNotesRef.current.find((note) => note.id === noteId);
      if (!current) return;

      const nextNote: StickyNote = {
        ...current,
        ...patch,
        updatedAt: Date.now()
      };

      const nextNotes = upsertStickyNote(stickyNotesRef.current, nextNote);
      replaceStickyNotes(nextNotes);

      socketRef.current?.emit("sticky_note_upsert", {
        roomId: activeRoomId,
        action: "update",
        note: nextNote
      });
    },
    [activeRoomId, replaceStickyNotes]
  );

  const moveStickyNote = useCallback(
    (noteId: string, x: number, y: number) => {
      const current = stickyNotesRef.current.find((note) => note.id === noteId);
      if (!current) return;

      const nextNote: StickyNote = {
        ...current,
        x,
        y,
        updatedAt: Date.now()
      };

      const nextNotes = upsertStickyNote(stickyNotesRef.current, nextNote);
      replaceStickyNotes(nextNotes);

      socketRef.current?.volatile.emit("sticky_note_upsert", {
        roomId: activeRoomId,
        action: "move",
        note: nextNote
      });
    },
    [activeRoomId, replaceStickyNotes]
  );

  const deleteStickyNote = useCallback(
    (noteId: string) => {
      const nextNotes = removeStickyNote(stickyNotesRef.current, noteId);
      replaceStickyNotes(nextNotes);

      socketRef.current?.emit("sticky_note_delete", {
        roomId: activeRoomId,
        noteId
      });
    },
    [activeRoomId, replaceStickyNotes]
  );

  const undoBoard = useCallback(() => {
    socketRef.current?.emit("undo_board", {
      roomId: activeRoomId
    });
  }, [activeRoomId]);

  const redoBoard = useCallback(() => {
    socketRef.current?.emit("redo_board", {
      roomId: activeRoomId
    });
  }, [activeRoomId]);

  const saveBoard = useCallback(() => {
    if (!isReady || !persistenceState.enabled) return;

    setSavingBoard(true);
    socketRef.current?.emit("save_board", {
      roomId: activeRoomId
    });
  }, [activeRoomId, isReady, persistenceState.enabled]);

  return {
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
  };
}
export type Tool = "pen" | "eraser";

export type Point = {
  x: number;
  y: number;
};

export type BoardStroke = {
  id: string;
  username: string;
  tool: Tool;
  color: string;
  size: number;
  points: Point[];
  finished: boolean;
  createdAt: number;
};

export type RoomUser = {
  sid: string;
  username: string;
  color: string;
};

export type RoomCursor = {
  sid: string;
  username: string;
  x: number;
  y: number;
  color: string;
  updatedAt: number;
};

export type ChatMessage = {
  id: string;
  sid: string;
  username: string;
  message: string;
  color: string;
  createdAt: number;
};

export type StickyNote = {
  id: string;
  sid: string;
  username: string;
  text: string;
  color: string;
  x: number;
  y: number;
  createdAt: number;
  updatedAt: number;
};

export type BoardHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historyLength: number;
};

export type PersistenceState = {
  enabled: boolean;
  hasPersistedData: boolean;
  lastSavedAt: number | null;
  lastError: string | null;
};

export type SocketStatus = "connecting" | "connected" | "disconnected" | "error";

export type RoomJoinedPayload = {
  roomId: string;
  sid: string;
  username: string;
  users: RoomUser[];
  boardState: BoardStroke[];
  cursors: RoomCursor[];
  messages: ChatMessage[];
  stickyNotes: StickyNote[];
  historyState: BoardHistoryState;
  persistence: PersistenceState;
};

export type BoardStateSyncPayload = {
  roomId: string;
  boardState: BoardStroke[];
  stickyNotes: StickyNote[];
  historyState: BoardHistoryState;
};

export type BoardSavedPayload = {
  roomId: string;
  success: boolean;
  reason: string;
  message?: string;
  savedAt: number | null;
  persistence: PersistenceState;
};
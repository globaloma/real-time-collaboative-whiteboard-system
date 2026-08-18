export type RecentRoom = {
  roomId: string;
  username: string;
  visitedAt: number;
};

const STORAGE_KEY = "boardly:recent-rooms";
const MAX_ENTRIES = 4;

export function getRecentRooms(): RecentRoom[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry): entry is RecentRoom =>
          entry && typeof entry.roomId === "string" && typeof entry.username === "string"
      )
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveRecentRoom(roomId: string, username: string) {
  if (typeof window === "undefined") return;

  try {
    const existing = getRecentRooms().filter((entry) => entry.roomId !== roomId);
    const next = [{ roomId, username, visitedAt: Date.now() }, ...existing].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage can throw in private browsing / storage-full states — safe to ignore.
  }
}

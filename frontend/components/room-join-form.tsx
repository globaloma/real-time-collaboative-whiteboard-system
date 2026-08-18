"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelativeTime } from "@/lib/utils";
import { getRecentRooms, type RecentRoom } from "@/lib/recent-rooms";

function generateRoomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().split("-")[0].toUpperCase();
  }

  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function RoomJoinForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState(() => generateRoomId());
  const [error, setError] = useState<string | null>(null);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);

  useEffect(() => {
    // Reading localStorage must happen after hydration — doing it in the
    // initial state would render differently on the server vs. the client.
    setRecentRooms(getRecentRooms());
  }, []);

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && roomId.trim().length > 0;
  }, [username, roomId]);

  const goToBoard = (cleanRoomId: string, cleanUsername: string) => {
    router.push(
      `/board?username=${encodeURIComponent(cleanUsername)}&room=${encodeURIComponent(cleanRoomId)}`
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleanUsername = username.trim();
    const cleanRoomId = roomId.trim().toUpperCase();

    if (!cleanUsername) {
      setError("Enter a username to continue.");
      return;
    }

    if (!cleanRoomId) {
      setError("Enter or generate a room ID.");
      return;
    }

    setError(null);
    goToBoard(cleanRoomId, cleanUsername);
  };

  return (
    <Card className="border-white/10 bg-surface-panel/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg text-white">Join or create a board</CardTitle>
        <CardDescription>
          Enter a username and room ID. Share the room ID with your team to collaborate.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Alex"
              autoComplete="username"
              maxLength={40}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomId">Room ID</Label>
            <div className="flex gap-2">
              <Input
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="TEAM-ROOM"
                autoComplete="off"
                spellCheck={false}
                maxLength={48}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Generate a new room ID"
                onClick={() => setRoomId(generateRoomId())}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
            Enter board
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        {recentRooms.length > 0 ? (
          <div className="space-y-2 border-t border-white/[0.06] pt-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Recent boards
            </p>
            <ul className="space-y-1">
              {recentRooms.map((room) => (
                <li key={room.roomId}>
                  <button
                    type="button"
                    onClick={() => goToBoard(room.roomId, room.username)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/[0.06]"
                  >
                    <span className="font-mono text-xs text-slate-200">{room.roomId}</span>
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(room.visitedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

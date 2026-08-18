import copy
import logging
import math
import os
import re
import time
from collections import deque
from threading import Lock
from uuid import uuid4

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room as socket_join_room

from firebase_persistence import (
    load_room_snapshot,
    persistence_enabled,
    persistence_error,
    save_room_snapshot
)

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s"
)
logger = logging.getLogger("whiteboard")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")

DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"

if app.config["SECRET_KEY"] == "dev-secret-key" and not DEBUG:
    logger.warning(
        "SECRET_KEY is unset and FLASK_DEBUG=0 — set SECRET_KEY before deploying to production."
    )

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGIN", "http://localhost:3000").split(",")
    if origin.strip()
]
CORS(app, resources={r"/*": {"origins": cors_origins}})

socketio = SocketIO(
    app,
    cors_allowed_origins=cors_origins,
    async_mode=os.getenv("SOCKETIO_ASYNC_MODE", "threading"),
    logger=False,
    engineio_logger=False
)

rooms = {}
sid_to_room = {}
state_lock = Lock()

HISTORY_LIMIT = 100
MAX_ROOM_ID_LENGTH = 48
MAX_USERNAME_LENGTH = 40
MAX_CHAT_LENGTH = 300
MAX_STICKY_TEXT_LENGTH = 500
MAX_POINTS_PER_STROKE = 8000
MAX_STROKES_PER_ROOM = 4000
MAX_STICKY_NOTES_PER_ROOM = 4000

ROOM_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,48}$")
HEX_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{3,8}$")

DEFAULT_STROKE_COLOR = "#111827"
DEFAULT_NOTE_COLOR = "#fde68a"

COLOR_PALETTE = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#84cc16",
    "#22c55e",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#d946ef",
    "#ec4899"
]


class RateLimiter:
    """Fixed-window-ish limiter: at most `max_events` per `window_seconds` per key."""

    def __init__(self, max_events: int, window_seconds: float):
        self.max_events = max_events
        self.window_seconds = window_seconds
        self._hits = {}

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        window = self._hits.setdefault(key, deque())

        while window and now - window[0] > self.window_seconds:
            window.popleft()

        if len(window) >= self.max_events:
            return False

        window.append(now)
        return True

    def drop(self, key: str):
        self._hits.pop(key, None)


chat_rate_limiter = RateLimiter(max_events=8, window_seconds=5)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def clean_str(value, max_length: int, fallback: str = "") -> str:
    text = str(value or "").strip()
    if not text:
        return fallback
    return text[:max_length]


def valid_room_id(room_id: str) -> bool:
    return bool(ROOM_ID_PATTERN.match(room_id))


def safe_color(value, fallback: str) -> str:
    text = str(value or "").strip()
    return text if HEX_COLOR_PATTERN.match(text) else fallback


def pick_color(seed: str):
    total = 0
    for char in seed:
        total += ord(char)
    return COLOR_PALETTE[total % len(COLOR_PALETTE)]


def normalize_point(point):
    """Points are coordinates relative to the canvas WIDTH on both axes (not
    normalized to canvas height independently), so a shape keeps its true
    proportions for every viewer regardless of window size or aspect ratio.
    x is naturally within [0, 1]; y is not (a tall, narrow window can have
    y > 1), so only a generous sanity bound is applied to guard against
    NaN/Infinity or wildly out-of-range values."""
    if not isinstance(point, dict):
        return {"x": 0.0, "y": 0.0}

    try:
        x = float(point.get("x", 0))
        y = float(point.get("y", 0))
    except (TypeError, ValueError):
        return {"x": 0.0, "y": 0.0}

    if not (math.isfinite(x) and math.isfinite(y)):
        return {"x": 0.0, "y": 0.0}

    return {"x": clamp(x, -10.0, 10.0), "y": clamp(y, -10.0, 10.0)}


def default_room():
    return {
        "users": {},
        "strokes": {},
        "stroke_order": [],
        "cursors": {},
        "messages": [],
        "sticky_notes": {},
        "history": [],
        "history_index": -1,
        "persisted_loaded": False,
        "last_saved_at": None,
        "last_persistence_error": None
    }


def serialize_stroke(stroke):
    return {
        "id": stroke["id"],
        "username": stroke["username"],
        "tool": stroke["tool"],
        "color": stroke["color"],
        "size": stroke["size"],
        "points": [normalize_point(point) for point in stroke["points"]],
        "finished": stroke["finished"],
        "createdAt": stroke["createdAt"]
    }


def serialize_users(room):
    return [
        {
            "sid": sid,
            "username": user["username"],
            "color": user["color"]
        }
        for sid, user in room["users"].items()
    ]


def serialize_board_state(room):
    return [
        serialize_stroke(room["strokes"][stroke_id])
        for stroke_id in room["stroke_order"]
        if stroke_id in room["strokes"]
    ]


def serialize_cursors(room):
    return list(room["cursors"].values())


def serialize_messages(room):
    return list(room["messages"][-100:])


def serialize_sticky_notes(room):
    notes = list(room["sticky_notes"].values())
    notes.sort(key=lambda note: (note.get("createdAt", 0), note.get("id", "")))
    return notes


def get_history_state(room):
    history_length = len(room["history"])
    history_index = room["history_index"]

    return {
        "canUndo": history_index > 0,
        "canRedo": history_index < history_length - 1,
        "historyIndex": max(history_index, 0),
        "historyLength": max(history_length, 1)
    }


def serialize_persistence_state(room, last_error=None):
    return {
        "enabled": persistence_enabled(),
        "hasPersistedData": bool(room.get("persisted_loaded")) or room.get("last_saved_at") is not None,
        "lastSavedAt": room.get("last_saved_at"),
        "lastError": last_error if last_error is not None else room.get("last_persistence_error")
    }


def push_board_snapshot(room):
    snapshot = {
        "boardState": copy.deepcopy(serialize_board_state(room)),
        "stickyNotes": copy.deepcopy(serialize_sticky_notes(room))
    }

    if room["history_index"] < len(room["history"]) - 1:
        room["history"] = room["history"][: room["history_index"] + 1]

    room["history"].append(snapshot)

    if len(room["history"]) > HISTORY_LIMIT:
        excess = len(room["history"]) - HISTORY_LIMIT
        room["history"] = room["history"][excess:]

    room["history_index"] = len(room["history"]) - 1


def restore_board_snapshot(room, snapshot):
    room["strokes"] = {}
    room["stroke_order"] = []

    for stroke in snapshot.get("boardState", []):
        stroke_copy = copy.deepcopy(stroke)
        room["strokes"][stroke_copy["id"]] = stroke_copy
        room["stroke_order"].append(stroke_copy["id"])

    room["sticky_notes"] = {}

    for note in snapshot.get("stickyNotes", []):
        note_copy = copy.deepcopy(note)
        room["sticky_notes"][note_copy["id"]] = note_copy


def hydrate_room_from_persisted(room_id: str, data: dict):
    room = default_room()

    board_state = data.get("boardState") or []
    sticky_notes = data.get("stickyNotes") or []
    messages = data.get("messages") or []
    history = data.get("history") or []

    for stroke in board_state:
        if not stroke.get("id"):
            continue
        room["strokes"][stroke["id"]] = copy.deepcopy(stroke)
        room["stroke_order"].append(stroke["id"])

    for note in sticky_notes:
        if not note.get("id"):
            continue
        room["sticky_notes"][note["id"]] = copy.deepcopy(note)

    room["messages"] = list(messages)[-100:]

    if history:
        room["history"] = copy.deepcopy(history)
        history_index = int(data.get("historyIndex", len(history) - 1))
        room["history_index"] = max(0, min(history_index, len(room["history"]) - 1))
    else:
        push_board_snapshot(room)

    room["persisted_loaded"] = True
    room["last_saved_at"] = data.get("savedAt") or data.get("updatedAt")

    rooms[room_id] = room
    return room


def create_empty_room(room_id: str):
    room = default_room()
    rooms[room_id] = room
    push_board_snapshot(room)
    return room


def get_or_create_room(room_id: str):
    if room_id in rooms:
        return rooms[room_id]

    persisted = load_room_snapshot(room_id)
    if persisted:
        return hydrate_room_from_persisted(room_id, persisted)

    return create_empty_room(room_id)


def build_persistence_snapshot(room_id: str, room: dict, reason: str):
    return {
        "roomId": room_id,
        "reason": reason,
        "boardState": copy.deepcopy(serialize_board_state(room)),
        "stickyNotes": copy.deepcopy(serialize_sticky_notes(room)),
        "messages": copy.deepcopy(serialize_messages(room)),
        "history": copy.deepcopy(room["history"]),
        "historyIndex": room["history_index"]
    }


def save_and_broadcast(room_id: str, reason: str):
    with state_lock:
        room = rooms.get(room_id)
        if not room:
            return None

        snapshot = build_persistence_snapshot(room_id, room, reason)
        current_persistence = serialize_persistence_state(room)

    saved_at = save_room_snapshot(room_id, snapshot)

    if saved_at is None:
        error_message = persistence_error() or "Firebase persistence is unavailable"
        logger.warning("Persistence save failed for room %s (%s): %s", room_id, reason, error_message)

        with state_lock:
            room = rooms.get(room_id)
            if room:
                room["last_persistence_error"] = error_message
                current_persistence = serialize_persistence_state(room, last_error=error_message)

        socketio.emit(
            "board_saved",
            {
                "roomId": room_id,
                "success": False,
                "reason": reason,
                "message": error_message,
                "savedAt": None,
                "persistence": current_persistence
            },
            to=room_id
        )
        return None

    with state_lock:
        room = rooms.get(room_id)
        if room:
            room["last_saved_at"] = saved_at
            room["persisted_loaded"] = True
            room["last_persistence_error"] = None
            current_persistence = serialize_persistence_state(room)

    socketio.emit(
        "board_saved",
        {
            "roomId": room_id,
            "success": True,
            "reason": reason,
            "message": "Board saved to Firebase",
            "savedAt": saved_at,
            "persistence": current_persistence
        },
        to=room_id
    )

    return saved_at


@app.after_request
def apply_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    return response


@app.get("/")
def index():
    return jsonify(
        service="Real-Time Collaborative Whiteboard API",
        status="running"
    )


@app.get("/health")
def health():
    with state_lock:
        room_count = len(rooms)

    return jsonify(
        status="ok",
        activeRooms=room_count,
        persistence={
            "enabled": persistence_enabled(),
            "error": persistence_error()
        }
    )


@app.get("/rooms")
def list_rooms():
    with state_lock:
        data = [
            {
                "roomId": room_id,
                "userCount": len(room["users"]),
                "strokeCount": len(room["strokes"]),
                "cursorCount": len(room["cursors"]),
                "messageCount": len(room["messages"]),
                "stickyNoteCount": len(room["sticky_notes"]),
                "historyLength": len(room["history"]),
                "lastSavedAt": room.get("last_saved_at")
            }
            for room_id, room in rooms.items()
        ]

    return jsonify(rooms=data)


@app.get("/rooms/<room_id>")
def get_room_state(room_id):
    if not valid_room_id(room_id):
        return jsonify(error="Invalid room id"), 400

    with state_lock:
        room = get_or_create_room(room_id)

        payload = {
            "roomId": room_id,
            "users": serialize_users(room),
            "boardState": serialize_board_state(room),
            "cursors": serialize_cursors(room),
            "messages": serialize_messages(room),
            "stickyNotes": serialize_sticky_notes(room),
            "historyState": get_history_state(room),
            "persistence": serialize_persistence_state(room)
        }

    return jsonify(payload)


@app.get("/rooms/<room_id>/persisted")
def get_persisted_room(room_id):
    if not valid_room_id(room_id):
        return jsonify(error="Invalid room id"), 400

    if not persistence_enabled():
        return jsonify(
            roomId=room_id,
            exists=False,
            enabled=False,
            error=persistence_error()
        ), 503

    snapshot = load_room_snapshot(room_id)
    if not snapshot:
        return jsonify(
            roomId=room_id,
            exists=False,
            enabled=True
        )

    return jsonify(
        roomId=room_id,
        exists=True,
        enabled=True,
        snapshot=snapshot
    )


@app.post("/rooms/<room_id>/save")
def save_room_http(room_id):
    if not valid_room_id(room_id):
        return jsonify(error="Invalid room id"), 400

    with state_lock:
        get_or_create_room(room_id)

    saved_at = save_and_broadcast(room_id, reason="http_manual_save")
    if saved_at is None:
        return jsonify(
            ok=False,
            roomId=room_id,
            error=persistence_error() or "Firebase persistence failed"
        ), 503

    with state_lock:
        room = rooms.get(room_id)
        persistence = serialize_persistence_state(room) if room else None

    return jsonify(
        ok=True,
        roomId=room_id,
        savedAt=saved_at,
        persistence=persistence
    )


@socketio.on("join_room")
def handle_join_room(data):
    data = data or {}
    room_id = clean_str(data.get("roomId") or data.get("room_id"), MAX_ROOM_ID_LENGTH)
    username = clean_str(data.get("username"), MAX_USERNAME_LENGTH, fallback="Guest")

    if not room_id or not valid_room_id(room_id):
        emit("server_error", {"message": "A valid roomId is required"})
        return

    user_color = pick_color(f"{username}:{request.sid}")

    with state_lock:
        room = get_or_create_room(room_id)

        room["users"][request.sid] = {
            "sid": request.sid,
            "username": username,
            "color": user_color
        }
        room["cursors"].pop(request.sid, None)
        sid_to_room[request.sid] = room_id

        users = serialize_users(room)
        board_state = serialize_board_state(room)
        cursors = serialize_cursors(room)
        messages = serialize_messages(room)
        sticky_notes = serialize_sticky_notes(room)
        history_state = get_history_state(room)
        persistence = serialize_persistence_state(room)

    socket_join_room(room_id)
    logger.info("join_room room=%s user=%s sid=%s", room_id, username, request.sid)

    emit(
        "room_joined",
        {
            "roomId": room_id,
            "sid": request.sid,
            "username": username,
            "users": users,
            "boardState": board_state,
            "cursors": cursors,
            "messages": messages,
            "stickyNotes": sticky_notes,
            "historyState": history_state,
            "persistence": persistence
        }
    )

    emit(
        "room_users",
        {
            "roomId": room_id,
            "users": users
        },
        to=room_id,
        include_self=False
    )


@socketio.on("draw_start")
def handle_draw_start(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    stroke = data.get("stroke") or {}

    stroke_id = clean_str(stroke.get("id"), 64)
    if not room_id or not stroke_id:
        return

    with state_lock:
        room = rooms.get(room_id)
        if not room or request.sid not in room["users"]:
            return

        if stroke_id not in room["strokes"] and len(room["strokes"]) >= MAX_STROKES_PER_ROOM:
            emit("server_error", {"message": "This board has reached its stroke limit. Clear the board to keep drawing."})
            return

        tool = stroke.get("tool") if stroke.get("tool") in ["pen", "eraser"] else "pen"
        size = int(stroke.get("size") or 4)

        normalized_stroke = {
            "id": stroke_id,
            "username": clean_str(stroke.get("username"), MAX_USERNAME_LENGTH, fallback="Guest"),
            "tool": tool,
            "color": safe_color(stroke.get("color"), DEFAULT_STROKE_COLOR),
            "size": clamp(size, 1, 64),
            "points": [normalize_point(point) for point in (stroke.get("points") or [])[:MAX_POINTS_PER_STROKE]],
            "finished": False,
            "createdAt": int(stroke.get("createdAt") or time.time() * 1000)
        }

        room["strokes"][stroke_id] = normalized_stroke
        if stroke_id not in room["stroke_order"]:
            room["stroke_order"].append(stroke_id)

    emit(
        "draw_start",
        {
            "roomId": room_id,
            "stroke": serialize_stroke(normalized_stroke)
        },
        to=room_id,
        include_self=False
    )


@socketio.on("draw_move")
def handle_draw_move(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    stroke_id = clean_str(data.get("strokeId"), 64)
    point = data.get("point")

    if not room_id or not stroke_id:
        return

    normalized_point = normalize_point(point)

    with state_lock:
        room = rooms.get(room_id)
        if not room:
            return

        stroke = room["strokes"].get(stroke_id)
        if not stroke or stroke["finished"]:
            return

        if len(stroke["points"]) >= MAX_POINTS_PER_STROKE:
            return

        stroke["points"].append(normalized_point)

    emit(
        "draw_move",
        {
            "roomId": room_id,
            "strokeId": stroke_id,
            "point": normalized_point
        },
        to=room_id,
        include_self=False
    )


@socketio.on("draw_end")
def handle_draw_end(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    stroke_id = clean_str(data.get("strokeId"), 64)

    if not room_id or not stroke_id:
        return

    with state_lock:
        room = rooms.get(room_id)
        if not room:
            return

        stroke = room["strokes"].get(stroke_id)
        if not stroke:
            return

        stroke["finished"] = True
        push_board_snapshot(room)
        history_state = get_history_state(room)

    save_and_broadcast(room_id, reason="draw_end")

    emit(
        "draw_end",
        {
            "roomId": room_id,
            "strokeId": stroke_id
        },
        to=room_id,
        include_self=False
    )

    emit(
        "board_history_state",
        {
            "roomId": room_id,
            "historyState": history_state
        },
        to=room_id
    )


@socketio.on("clear_canvas")
def handle_clear_canvas(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    if not room_id:
        return

    with state_lock:
        room = rooms.get(room_id)
        if not room:
            return

        room["strokes"].clear()
        room["stroke_order"].clear()
        room["sticky_notes"].clear()
        push_board_snapshot(room)
        history_state = get_history_state(room)

    save_and_broadcast(room_id, reason="clear_canvas")

    emit(
        "clear_canvas",
        {"roomId": room_id},
        to=room_id,
        include_self=False
    )

    emit(
        "board_history_state",
        {
            "roomId": room_id,
            "historyState": history_state
        },
        to=room_id
    )


@socketio.on("cursor_move")
def handle_cursor_move(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    point = data.get("point")

    if not room_id:
        return

    normalized_point = normalize_point(point)

    with state_lock:
        room = rooms.get(room_id)
        if not room:
            return

        user = room["users"].get(request.sid)
        if not user:
            return

        cursor = {
            "sid": request.sid,
            "username": user["username"],
            "x": normalized_point["x"],
            "y": normalized_point["y"],
            "color": user["color"],
            "updatedAt": int(time.time() * 1000)
        }

        room["cursors"][request.sid] = cursor

    emit(
        "cursor_move",
        {
            "roomId": room_id,
            "cursor": cursor
        },
        to=room_id,
        include_self=False
    )


@socketio.on("chat_message")
def handle_chat_message(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    message_text = clean_str(data.get("message"), MAX_CHAT_LENGTH)

    if not room_id or not message_text:
        return

    if not chat_rate_limiter.allow(request.sid):
        emit("server_error", {"message": "You're sending messages too fast. Please slow down."})
        return

    with state_lock:
        room = rooms.get(room_id)
        if not room:
            return

        user = room["users"].get(request.sid)
        if not user:
            return

        message = {
            "id": str(uuid4()),
            "sid": request.sid,
            "username": user["username"],
            "message": message_text,
            "color": user["color"],
            "createdAt": int(time.time() * 1000)
        }

        room["messages"].append(message)
        room["messages"] = room["messages"][-100:]

    save_and_broadcast(room_id, reason="chat_message")

    emit(
        "chat_message",
        {
            "roomId": room_id,
            "message": message
        },
        to=room_id
    )


@socketio.on("sticky_note_upsert")
def handle_sticky_note_upsert(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    action = clean_str(data.get("action"), 16, fallback="update")
    note = data.get("note") or {}

    note_id = clean_str(note.get("id"), 64)
    if not room_id or not note_id:
        return

    with state_lock:
        room = rooms.get(room_id)
        if not room:
            return

        if note_id not in room["sticky_notes"] and len(room["sticky_notes"]) >= MAX_STICKY_NOTES_PER_ROOM:
            emit("server_error", {"message": "This board has reached its sticky note limit."})
            return

        point = normalize_point({"x": note.get("x"), "y": note.get("y")})

        normalized_note = {
            "id": note_id,
            "sid": clean_str(note.get("sid"), 64, fallback=request.sid),
            "username": clean_str(note.get("username"), MAX_USERNAME_LENGTH, fallback="Guest"),
            "text": clean_str(note.get("text"), MAX_STICKY_TEXT_LENGTH, fallback="New idea"),
            "color": safe_color(note.get("color"), DEFAULT_NOTE_COLOR),
            "x": point["x"],
            "y": point["y"],
            "createdAt": int(note.get("createdAt") or time.time() * 1000),
            "updatedAt": int(note.get("updatedAt") or time.time() * 1000)
        }

        room["sticky_notes"][note_id] = normalized_note

        should_snapshot = action != "move"
        if should_snapshot:
            push_board_snapshot(room)
            history_state = get_history_state(room)
        else:
            history_state = None

    if action != "move":
        save_and_broadcast(room_id, reason=f"sticky_note_{action}")

    emit(
        "sticky_note_upsert",
        {
            "roomId": room_id,
            "note": normalized_note
        },
        to=room_id,
        include_self=False
    )

    if history_state is not None:
        emit(
            "board_history_state",
            {
                "roomId": room_id,
                "historyState": history_state
            },
            to=room_id
        )


@socketio.on("sticky_note_delete")
def handle_sticky_note_delete(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    note_id = clean_str(data.get("noteId"), 64)

    if not room_id or not note_id:
        return

    with state_lock:
        room = rooms.get(room_id)
        if not room:
            return

        room["sticky_notes"].pop(note_id, None)
        push_board_snapshot(room)
        history_state = get_history_state(room)

    save_and_broadcast(room_id, reason="sticky_note_delete")

    emit(
        "sticky_note_delete",
        {
            "roomId": room_id,
            "noteId": note_id
        },
        to=room_id,
        include_self=False
    )

    emit(
        "board_history_state",
        {
            "roomId": room_id,
            "historyState": history_state
        },
        to=room_id
    )


@socketio.on("undo_board")
def handle_undo_board(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    if not room_id:
        return

    with state_lock:
        room = rooms.get(room_id)
        if not room:
            return

        if room["history_index"] <= 0:
            history_state = get_history_state(room)
        else:
            room["history_index"] -= 1
            snapshot = room["history"][room["history_index"]]
            restore_board_snapshot(room, snapshot)
            history_state = get_history_state(room)

        board_state = serialize_board_state(room)
        sticky_notes = serialize_sticky_notes(room)

    if history_state["canUndo"] or history_state["canRedo"]:
        save_and_broadcast(room_id, reason="undo_board")

    emit(
        "board_state_sync",
        {
            "roomId": room_id,
            "boardState": board_state,
            "stickyNotes": sticky_notes,
            "historyState": history_state
        },
        to=room_id
    )

    emit(
        "board_history_state",
        {
            "roomId": room_id,
            "historyState": history_state
        },
        to=room_id
    )


@socketio.on("redo_board")
def handle_redo_board(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    if not room_id:
        return

    with state_lock:
        room = rooms.get(room_id)
        if not room:
            return

        if room["history_index"] >= len(room["history"]) - 1:
            history_state = get_history_state(room)
        else:
            room["history_index"] += 1
            snapshot = room["history"][room["history_index"]]
            restore_board_snapshot(room, snapshot)
            history_state = get_history_state(room)

        board_state = serialize_board_state(room)
        sticky_notes = serialize_sticky_notes(room)

    if history_state["canUndo"] or history_state["canRedo"]:
        save_and_broadcast(room_id, reason="redo_board")

    emit(
        "board_state_sync",
        {
            "roomId": room_id,
            "boardState": board_state,
            "stickyNotes": sticky_notes,
            "historyState": history_state
        },
        to=room_id
    )

    emit(
        "board_history_state",
        {
            "roomId": room_id,
            "historyState": history_state
        },
        to=room_id
    )


@socketio.on("save_board")
def handle_save_board(data):
    data = data or {}
    room_id = clean_str(data.get("roomId"), MAX_ROOM_ID_LENGTH)
    if not room_id:
        emit("server_error", {"message": "roomId is required for save_board"})
        return

    save_and_broadcast(room_id, reason="manual_save")


@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid
    chat_rate_limiter.drop(sid)

    with state_lock:
        room_id = sid_to_room.pop(sid, None)

        if not room_id:
            return

        room = rooms.get(room_id)
        if not room:
            return

        room["users"].pop(sid, None)
        room["cursors"].pop(sid, None)

        users = serialize_users(room)
        room_emptied = not room["users"]

        if room_emptied:
            rooms.pop(room_id, None)

    if room_emptied:
        # Persist the final state after the in-memory room is gone so the
        # next join can rehydrate from Firestore.
        save_and_broadcast_after_room_removed(room_id, room)
        return

    emit(
        "room_users",
        {
            "roomId": room_id,
            "users": users
        },
        to=room_id,
        include_self=False
    )

    emit(
        "cursor_remove",
        {
            "roomId": room_id,
            "sid": sid
        },
        to=room_id,
        include_self=False
    )


def save_and_broadcast_after_room_removed(room_id: str, room: dict):
    snapshot = build_persistence_snapshot(room_id, room, "disconnect")
    saved_at = save_room_snapshot(room_id, snapshot)
    if saved_at is None:
        logger.warning(
            "Persistence save failed for emptied room %s: %s",
            room_id,
            persistence_error() or "unknown error"
        )


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))

    if DEBUG:
        logger.warning("Starting in DEBUG mode — do not use this in production.")

    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=DEBUG,
        allow_unsafe_werkzeug=DEBUG
    )

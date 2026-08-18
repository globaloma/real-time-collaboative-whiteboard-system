# Boardly — backend

Flask-SocketIO backend for Boardly, a real-time collaborative whiteboard. Holds each room's live
state in memory and persists snapshots to Firestore.

## Local development

```bash
python -m venv .venv
./.venv/Scripts/activate      # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # fill in Firebase credentials if you want persistence
python app.py
```

Runs on `http://localhost:5000`. `FLASK_DEBUG=1` in `.env` enables the auto-reloader for local
dev — never set it in production.

## Production

Production uses `gunicorn` with the `eventlet` worker (required for real WebSocket support —
`gunicorn` itself only runs on Linux/macOS, not Windows):

```bash
gunicorn --worker-class eventlet -w 1 wsgi:app
```

`wsgi.py` monkey-patches with eventlet before anything else is imported; set
`SOCKETIO_ASYNC_MODE=eventlet` so Flask-SocketIO's internal mode matches the worker. See
`render.yaml` for a ready-to-use Render Blueprint, or `Procfile` for platforms that read one.

Required environment variables in production: `CORS_ORIGIN` (the deployed frontend's origin),
`SECRET_KEY`, and either `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH` if you
want Firestore persistence (optional — the app runs fine without it, just without autosave).

## Notes

- Room state lives in a single process's memory (`rooms` dict) — running more than one instance
  will split users across processes with no shared state. Keep this service scaled to a single
  instance unless that's addressed with a shared store (e.g. Redis).
- `/health` reports process status, active room count, and Firebase persistence status.

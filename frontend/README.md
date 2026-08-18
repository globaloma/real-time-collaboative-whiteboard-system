# Boardly — frontend

Next.js 15 (App Router) frontend for Boardly, a real-time collaborative whiteboard. Talks to the
Flask-SocketIO backend in `../backend` over WebSockets for live drawing, cursors, chat, and sticky
notes.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # point NEXT_PUBLIC_BACKEND_URL at your backend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The backend must be running (see
`../backend/README` equivalent — `python app.py`) for the board page to connect.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint

## Structure

- `app/` — routes: `/` (landing + room join) and `/board` (the whiteboard workspace)
- `components/` — UI, split into feature components (board, chat, sticky notes, toolbar) and
  `components/ui/` primitives (button, card, dialog, tooltip, etc.)
- `hooks/use-whiteboard-room.ts` — the Socket.IO client state machine the board page is built on
- `lib/types.ts` — shared types mirroring the backend's socket event payloads

Stroke, cursor, and sticky-note positions are stored as fractional (0–1) coordinates relative to
the canvas, so a board renders identically for every viewer regardless of window size.

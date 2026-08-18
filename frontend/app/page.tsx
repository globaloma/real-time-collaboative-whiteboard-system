import { PenTool, MessagesSquare, StickyNote, Users, History, Cloud } from "lucide-react";
import { RoomJoinForm } from "@/components/room-join-form";
import { BoardPreview } from "@/components/marketing/board-preview";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: PenTool,
    title: "Live drawing sync",
    description: "Every stroke streams to the room instantly, pixel-perfect on any screen size."
  },
  {
    icon: StickyNote,
    title: "Sticky notes",
    description: "Drop ideas anywhere on the board and edit them together in real time."
  },
  {
    icon: Users,
    title: "Presence & cursors",
    description: "See who's in the room and watch their cursor move as they work."
  },
  {
    icon: MessagesSquare,
    title: "Built-in chat",
    description: "Talk through ideas without leaving the board or switching tabs."
  },
  {
    icon: History,
    title: "Undo history",
    description: "Full undo/redo across drawings, notes, and clears — synced for everyone."
  },
  {
    icon: Cloud,
    title: "Cloud persistence",
    description: "Boards save to Firebase automatically, so you can pick up right where you left off."
  }
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-surface">
      <div className="pointer-events-none absolute inset-0 bg-grid-glow" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col px-6 pb-24">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 shadow-glow">
              <PenTool className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">Boardly</span>
          </div>

          <Badge variant="brand">Free while in beta</Badge>
        </header>

        <section className="grid gap-16 pt-12 lg:grid-cols-2 lg:items-center lg:pt-20">
          <div className="animate-slide-up space-y-8">
            <div className="space-y-5">
              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
                Whiteboard together,
                <br />
                <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">
                  in real time.
                </span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-slate-400">
                Sketch, drop sticky notes, and chat with your team on one shared canvas.
                No downloads, no sign-up — just open a room and start.
              </p>
            </div>

            <ul className="flex flex-wrap gap-2">
              {["No install", "No account needed", "Live cursors", "Autosaves"].map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-400"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div id="join" className="animate-slide-up [animation-delay:100ms]">
            <RoomJoinForm />
          </div>
        </section>

        <section className="mt-28 lg:mt-36">
          <BoardPreview />
        </section>

        <section className="mt-28 lg:mt-36">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Everything a team needs on one canvas
            </h2>
            <p className="mt-3 text-slate-400">
              Built on Socket.IO for instant sync and Firestore for durable history.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-white/[0.08] bg-surface-panel p-6 transition-colors hover:border-brand-500/30 hover:bg-white/[0.03]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 transition-colors group-hover:bg-brand-500/20">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-100">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-28 flex flex-col items-center gap-4 border-t border-white/[0.06] pt-8 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Boardly. Built for real-time collaboration.</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            All systems operational
          </span>
        </footer>
      </div>
    </main>
  );
}

import { MousePointer2 } from "lucide-react";

const CURSORS = [
  { name: "Priya", color: "#6366f1", top: "22%", left: "62%" },
  { name: "Sam", color: "#f97316", top: "58%", left: "18%" },
  { name: "Riko", color: "#22c55e", top: "68%", left: "72%" }
];

const NOTES = [
  { color: "#fde68a", top: "16%", left: "8%", rotate: "-4deg", text: "Kickoff Monday" },
  { color: "#bbf7d0", top: "58%", left: "46%", rotate: "3deg", text: "Ship v1 ✦" },
  { color: "#bfdbfe", top: "20%", left: "76%", rotate: "-2deg", text: "Gather feedback" }
];

export function BoardPreview() {
  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="absolute -inset-x-8 -inset-y-8 -z-10 rounded-[2.5rem] bg-brand-500/10 blur-3xl" />

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-panel shadow-soft">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <div className="ml-3 h-6 flex-1 max-w-xs rounded-md bg-white/[0.04]" />
        </div>

        <div className="relative h-72 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[size:22px_22px] sm:h-96">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 800 400"
            fill="none"
            preserveAspectRatio="none"
          >
            <path
              d="M 60 300 C 140 220, 180 340, 260 260 S 400 160, 480 220"
              stroke="#818cf8"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />
            <path
              d="M 520 120 C 580 90, 620 150, 690 110"
              stroke="#f472b6"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.7"
            />
          </svg>

          {NOTES.map((note) => (
            <div
              key={note.text}
              className="absolute w-32 rounded-lg p-3 text-[11px] font-medium text-slate-900 shadow-lg sm:w-36"
              style={{
                top: note.top,
                left: note.left,
                backgroundColor: note.color,
                transform: `rotate(${note.rotate})`
              }}
            >
              {note.text}
            </div>
          ))}

          {CURSORS.map((cursor) => (
            <div
              key={cursor.name}
              className="absolute flex -translate-x-1 -translate-y-1 items-center gap-1.5 animate-fade-in"
              style={{ top: cursor.top, left: cursor.left }}
            >
              <MousePointer2
                className="h-4 w-4 drop-shadow"
                style={{ color: cursor.color }}
                fill={cursor.color}
              />
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow"
                style={{ backgroundColor: cursor.color }}
              >
                {cursor.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

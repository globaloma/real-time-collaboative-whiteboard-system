"use client";

import { Eraser, Pencil, Redo2, Trash2, Undo2 } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { Separator } from "@/components/ui/separator";
import { IconTooltip } from "@/components/ui/tooltip";
import { Tool } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  tool: Tool;
  color: string;
  size: number;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
};

const SIZE_PRESETS = [3, 6, 12, 20];

function IconButton({
  active,
  disabled,
  onClick,
  children,
  variant = "default"
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-brand-500 text-white shadow-sm"
          : variant === "danger"
          ? "text-slate-300 hover:bg-rose-500/15 hover:text-rose-300"
          : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export function WhiteboardToolbar({
  tool,
  color,
  size,
  onToolChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  disabled
}: Props) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-surface-panel/95 p-1.5 shadow-soft backdrop-blur">
      <IconTooltip label="Pen" shortcut="P">
        <IconButton active={tool === "pen"} disabled={disabled} onClick={() => onToolChange("pen")}>
          <Pencil className="h-4 w-4" />
        </IconButton>
      </IconTooltip>

      <IconTooltip label="Eraser" shortcut="E">
        <IconButton
          active={tool === "eraser"}
          disabled={disabled}
          onClick={() => onToolChange("eraser")}
        >
          <Eraser className="h-4 w-4" />
        </IconButton>
      </IconTooltip>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ColorPicker value={color} onChange={onColorChange} disabled={disabled} />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-1 px-1">
        {SIZE_PRESETS.map((preset) => (
          <IconTooltip key={preset} label={`${preset}px brush`}>
            <button
              type="button"
              onClick={() => onSizeChange(preset)}
              disabled={disabled}
              aria-label={`${preset}px brush`}
              className={cn(
                "flex h-9 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                size === preset ? "bg-white/10" : "hover:bg-white/[0.06]"
              )}
            >
              <span
                className="rounded-full bg-slate-100"
                style={{ width: Math.min(preset, 18), height: Math.min(preset, 18) }}
              />
            </button>
          </IconTooltip>
        ))}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <IconTooltip label="Undo" shortcut="⌘Z">
        <IconButton disabled={disabled || !canUndo} onClick={onUndo}>
          <Undo2 className="h-4 w-4" />
        </IconButton>
      </IconTooltip>

      <IconTooltip label="Redo" shortcut="⌘⇧Z">
        <IconButton disabled={disabled || !canRedo} onClick={onRedo}>
          <Redo2 className="h-4 w-4" />
        </IconButton>
      </IconTooltip>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <IconTooltip label="Clear board">
        <IconButton variant="danger" disabled={disabled} onClick={onClear}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </IconTooltip>
    </div>
  );
}

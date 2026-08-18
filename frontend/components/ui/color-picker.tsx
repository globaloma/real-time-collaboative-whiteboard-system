"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check } from "lucide-react";
import { IconTooltip } from "@/components/ui/tooltip";

const SWATCHES = [
  "#f8fafc",
  "#111827",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#d946ef"
];

type Props = {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
};

export function ColorPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <IconTooltip label="Color">
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Choose color"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className="h-5 w-5 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: value }}
            />
          </button>
        </PopoverPrimitive.Trigger>
      </IconTooltip>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={10}
          className="z-50 w-52 rounded-xl border border-white/10 bg-surface-panel p-3 shadow-soft animate-scale-in"
        >
          <div className="grid grid-cols-5 gap-2">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => {
                  onChange(swatch);
                  setOpen(false);
                }}
                aria-label={`Use color ${swatch}`}
                className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110"
                style={{ backgroundColor: swatch }}
              >
                {value.toLowerCase() === swatch ? (
                  <Check
                    className="h-4 w-4"
                    style={{ color: swatch === "#f8fafc" ? "#111827" : "#f8fafc" }}
                  />
                ) : null}
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-slate-400">
            Custom
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-6 w-10 cursor-pointer rounded border border-white/10 bg-transparent p-0"
            />
          </label>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

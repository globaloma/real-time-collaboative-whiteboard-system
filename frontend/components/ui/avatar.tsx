import * as React from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

type AvatarProps = React.HTMLAttributes<HTMLDivElement> & {
  name: string;
  color: string;
  size?: "sm" | "md";
};

export function Avatar({ name, color, size = "md", className, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface-panel",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs",
        className
      )}
      style={{ backgroundColor: color }}
      title={name}
      {...props}
    >
      {initials(name)}
    </div>
  );
}

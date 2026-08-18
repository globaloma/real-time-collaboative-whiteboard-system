"use client";

import { useEffect, useRef } from "react";
import { BoardStroke, Point } from "@/lib/types";
import { cn } from "@/lib/utils";

type PointerHandler = (point: Point) => void;

type Props = {
  strokes: BoardStroke[];
  className?: string;
  onPointerDown?: PointerHandler;
  onPointerMove?: PointerHandler;
  onPointerUp?: PointerHandler;
};

export function WhiteboardCanvas({
  strokes,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  };

  // Points are stored as fractions of the canvas WIDTH for both axes (not
  // width/height independently) so a stroke keeps its true proportions for
  // every viewer — normalizing x and y separately would stretch shapes
  // whenever two viewers' canvases have different aspect ratios.
  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.width
    };
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: BoardStroke, width: number) => {
    if (!stroke.points.length) return;

    const toPixels = (point: Point) => ({ x: point.x * width, y: point.y * width });

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.size;
    ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.tool === "eraser" ? "#000000" : stroke.color;
    ctx.fillStyle = stroke.tool === "eraser" ? "#000000" : stroke.color;

    if (stroke.points.length === 1) {
      const p = toPixels(stroke.points[0]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      const start = toPixels(stroke.points[0]);
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length; i += 1) {
        const p = toPixels(stroke.points[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    ctx.restore();
  };

  const redrawAll = () => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    ctx.clearRect(0, 0, width, height);

    for (const stroke of strokes) {
      drawStroke(ctx, stroke, width);
    }
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = getContext();

    if (!canvas || !container || !ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawAll();
  };

  useEffect(() => {
    resizeCanvas();

    const handleResize = () => resizeCanvas();
    window.addEventListener("resize", handleResize);

    let observer: ResizeObserver | null = null;
    if (typeof window !== "undefined" && "ResizeObserver" in window && containerRef.current) {
      observer = new ResizeObserver(handleResize);
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    redrawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    onPointerDown?.(getPoint(event));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    onPointerMove?.(getPoint(event));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    event.preventDefault();

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    onPointerUp?.(getPoint(event));
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden rounded-[1.75rem] border border-black/5 bg-white shadow-soft",
        "bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.12)_1px,transparent_0)] bg-[size:24px_24px]",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}

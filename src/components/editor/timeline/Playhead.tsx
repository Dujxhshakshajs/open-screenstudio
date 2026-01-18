import { useCallback, useRef } from "react";
import { PLAYHEAD_WIDTH, PLAYHEAD_HEAD_SIZE } from "./constants";

interface PlayheadProps {
  timeMs: number;
  pxPerMs: number;
  height: number;
  onSeek: (timeMs: number) => void;
  totalDurationMs: number;
}

export default function Playhead({
  timeMs,
  pxPerMs,
  height,
  onSeek,
  totalDurationMs,
}: PlayheadProps) {
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const x = timeMs * pxPerMs;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current || !containerRef.current) return;

        const container = containerRef.current.parentElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const relativeX = moveEvent.clientX - rect.left;
        const newTimeMs = Math.max(
          0,
          Math.min(relativeX / pxPerMs, totalDurationMs),
        );
        onSeek(newTimeMs);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [pxPerMs, totalDurationMs, onSeek],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 1000 : 100; // 1s or 100ms
      if (e.key === "ArrowLeft") {
        onSeek(Math.max(0, timeMs - step));
      } else if (e.key === "ArrowRight") {
        onSeek(Math.min(totalDurationMs, timeMs + step));
      }
    },
    [timeMs, totalDurationMs, onSeek],
  );

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Playhead position"
      aria-valuenow={Math.round(timeMs)}
      aria-valuemin={0}
      aria-valuemax={Math.round(totalDurationMs)}
      aria-valuetext={`${(timeMs / 1000).toFixed(1)} seconds`}
      tabIndex={0}
      className="absolute top-0 z-20 pointer-events-auto cursor-ew-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      style={{
        left: x - PLAYHEAD_WIDTH / 2,
        height,
        width: PLAYHEAD_WIDTH,
      }}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
    >
      {/* Playhead handle (triangle at top) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 bg-[hsl(var(--timeline-playhead))]"
        style={{
          width: PLAYHEAD_HEAD_SIZE,
          height: PLAYHEAD_HEAD_SIZE,
          clipPath: "polygon(0 0, 100% 0, 50% 100%)",
        }}
      />
      {/* Vertical line */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-[hsl(var(--timeline-playhead))]"
        style={{
          top: PLAYHEAD_HEAD_SIZE,
          height: height - PLAYHEAD_HEAD_SIZE,
        }}
      />
    </div>
  );
}

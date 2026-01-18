import { useCallback, useRef } from "react";

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

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Playhead"
      aria-valuenow={timeMs}
      aria-valuemin={0}
      aria-valuemax={totalDurationMs}
      tabIndex={0}
      className="absolute top-0 z-20 pointer-events-auto cursor-ew-resize"
      style={{
        left: x - 6,
        height,
        width: 12,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Playhead handle (triangle at top) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500"
        style={{
          clipPath: "polygon(0 0, 100% 0, 50% 100%)",
        }}
      />
      {/* Vertical line */}
      <div
        className="absolute top-3 left-1/2 -translate-x-1/2 w-0.5 bg-red-500"
        style={{ height: height - 12 }}
      />
    </div>
  );
}

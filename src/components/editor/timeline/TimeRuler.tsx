import { useMemo } from "react";
import {
  TIMELINE_RULER_HEIGHT,
  RULER_TARGET_PX_PER_TICK,
  RULER_NICE_INTERVALS_MS,
  RULER_MAJOR_TICK_MULTIPLIER,
} from "./constants";

interface TimeRulerProps {
  durationMs: number;
  pxPerMs: number;
  offsetX: number;
}

/**
 * Format time in milliseconds to a readable string
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

/**
 * Calculate appropriate tick interval based on zoom level
 */
function calculateTickInterval(pxPerMs: number): number {
  const msPerTick = RULER_TARGET_PX_PER_TICK / pxPerMs;

  for (const interval of RULER_NICE_INTERVALS_MS) {
    if (msPerTick <= interval) {
      return interval;
    }
  }
  return RULER_NICE_INTERVALS_MS[RULER_NICE_INTERVALS_MS.length - 1];
}

export default function TimeRuler({
  durationMs,
  pxPerMs,
  offsetX,
}: TimeRulerProps) {
  const tickInterval = useMemo(() => calculateTickInterval(pxPerMs), [pxPerMs]);

  const ticks = useMemo(() => {
    const result: { timeMs: number; isMajor: boolean }[] = [];
    const majorInterval = tickInterval * RULER_MAJOR_TICK_MULTIPLIER;

    for (let time = 0; time <= durationMs; time += tickInterval) {
      result.push({
        timeMs: time,
        isMajor: time % majorInterval === 0,
      });
    }
    return result;
  }, [durationMs, tickInterval]);

  const totalWidth = durationMs * pxPerMs;

  return (
    <div
      className="relative bg-muted border-b border-border select-none overflow-hidden"
      style={{ width: totalWidth, height: TIMELINE_RULER_HEIGHT }}
    >
      {ticks.map(({ timeMs, isMajor }) => {
        const x = timeMs * pxPerMs - offsetX;
        // Only render visible ticks (with some buffer)
        if (x < -50 || x > totalWidth + 50) return null;

        return (
          <div
            key={timeMs}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: x }}
          >
            <div
              className={`w-px ${
                isMajor ? "h-3 bg-foreground" : "h-2 bg-foreground/40"
              }`}
            />
            {isMajor && (
              <span className="text-[11px] text-foreground/60 mt-0.5 tabular-nums">
                {formatTime(timeMs)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

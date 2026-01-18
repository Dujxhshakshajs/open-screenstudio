import { useMemo } from "react";

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
  // We want ticks roughly every 50-100px
  const targetPxPerTick = 80;
  const msPerTick = targetPxPerTick / pxPerMs;

  // Round to nice intervals: 1s, 2s, 5s, 10s, 15s, 30s, 60s
  const niceIntervals = [1000, 2000, 5000, 10000, 15000, 30000, 60000];
  for (const interval of niceIntervals) {
    if (msPerTick <= interval) {
      return interval;
    }
  }
  return 60000;
}

export default function TimeRuler({
  durationMs,
  pxPerMs,
  offsetX,
}: TimeRulerProps) {
  const tickInterval = useMemo(() => calculateTickInterval(pxPerMs), [pxPerMs]);

  const ticks = useMemo(() => {
    const result: { timeMs: number; isMajor: boolean }[] = [];
    const majorInterval = tickInterval * 5; // Every 5th tick is major

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
      className="relative h-6 bg-[--muted] border-b border-[--border] select-none overflow-hidden"
      style={{ width: totalWidth }}
    >
      {ticks.map(({ timeMs, isMajor }) => {
        const x = timeMs * pxPerMs - offsetX;
        // Only render visible ticks
        if (x < -50 || x > totalWidth + 50) return null;

        return (
          <div
            key={timeMs}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: x }}
          >
            <div
              className={`w-px ${isMajor ? "h-3 bg-[--foreground]" : "h-2 bg-[--foreground]/50"}`}
            />
            {isMajor && (
              <span className="text-[10px] text-[--foreground]/70 mt-0.5">
                {formatTime(timeMs)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

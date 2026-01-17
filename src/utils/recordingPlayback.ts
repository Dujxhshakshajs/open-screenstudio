/**
 * Recording Playback Utilities
 *
 * Utilities for efficient time-based lookup of cursor positions and events
 * during recording playback.
 */

import type { MouseMoveEvent, MouseClickEvent } from "../types/recording";

/**
 * Binary search to find the index of the event at or just before the given time
 * Returns -1 if time is before all events
 */
function binarySearchTime<T extends { processTimeMs: number }>(
  events: T[],
  timeMs: number,
): number {
  if (events.length === 0) return -1;

  let left = 0;
  let right = events.length - 1;

  // If time is before first event, return -1
  if (timeMs < events[0].processTimeMs) return -1;

  // If time is after last event, return last index
  if (timeMs >= events[right].processTimeMs) return right;

  // Binary search for the event at or just before timeMs
  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    if (events[mid].processTimeMs <= timeMs) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  return left;
}

/**
 * Find the cursor position at a given playback time
 * Uses binary search for efficient lookup in large datasets
 *
 * @param moves Array of mouse move events (sorted by processTimeMs)
 * @param timeMs Current playback time in milliseconds
 * @returns The mouse move event at or just before the given time, or null
 */
export function findCursorAtTime(
  moves: MouseMoveEvent[],
  timeMs: number,
): MouseMoveEvent | null {
  const index = binarySearchTime(moves, timeMs);
  return index >= 0 ? moves[index] : null;
}

/**
 * Find cursor position with interpolation between two events
 * Provides smoother cursor movement during playback
 *
 * @param moves Array of mouse move events (sorted by processTimeMs)
 * @param timeMs Current playback time in milliseconds
 * @returns Interpolated position or null if no events
 */
export function findCursorAtTimeInterpolated(
  moves: MouseMoveEvent[],
  timeMs: number,
): { x: number; y: number; cursorId: string } | null {
  if (moves.length === 0) return null;

  const index = binarySearchTime(moves, timeMs);

  if (index < 0) {
    // Before first event - return first position
    return {
      x: moves[0].x,
      y: moves[0].y,
      cursorId: moves[0].cursorId,
    };
  }

  const current = moves[index];

  // If we're at or past the last event, return it directly
  if (index >= moves.length - 1) {
    return {
      x: current.x,
      y: current.y,
      cursorId: current.cursorId,
    };
  }

  const next = moves[index + 1];

  // Calculate interpolation factor
  const timeDelta = next.processTimeMs - current.processTimeMs;
  if (timeDelta <= 0) {
    return {
      x: current.x,
      y: current.y,
      cursorId: current.cursorId,
    };
  }

  const t = (timeMs - current.processTimeMs) / timeDelta;

  // Linear interpolation
  return {
    x: current.x + (next.x - current.x) * t,
    y: current.y + (next.y - current.y) * t,
    cursorId: current.cursorId, // Use current cursor (don't interpolate cursor type)
  };
}

/**
 * Find all click events within a time range
 * Useful for showing click indicators during playback
 *
 * @param clicks Array of click events (sorted by processTimeMs)
 * @param startTimeMs Start of time range
 * @param endTimeMs End of time range
 * @returns Array of click events in the range
 */
export function findClicksInRange(
  clicks: MouseClickEvent[],
  startTimeMs: number,
  endTimeMs: number,
): MouseClickEvent[] {
  if (clicks.length === 0) return [];

  const startIndex = binarySearchTime(clicks, startTimeMs);
  const results: MouseClickEvent[] = [];

  // Start from the found index (or 0 if before all events)
  const start = Math.max(0, startIndex);

  for (let i = start; i < clicks.length; i++) {
    const click = clicks[i];
    if (click.processTimeMs > endTimeMs) break;
    if (click.processTimeMs >= startTimeMs) {
      results.push(click);
    }
  }

  return results;
}

/**
 * Find recent click events for visualization
 * Returns "down" events that occurred within the specified duration
 *
 * @param clicks Array of click events (sorted by processTimeMs)
 * @param currentTimeMs Current playback time
 * @param durationMs How far back to look for clicks (default 500ms)
 * @returns Array of recent click down events with age info
 */
export function findRecentClicks(
  clicks: MouseClickEvent[],
  currentTimeMs: number,
  durationMs: number = 500,
): Array<MouseClickEvent & { age: number }> {
  const startTime = currentTimeMs - durationMs;
  const recentClicks = findClicksInRange(clicks, startTime, currentTimeMs);

  // Filter to only "down" events and add age
  return recentClicks
    .filter((click) => click.eventType === "down")
    .map((click) => ({
      ...click,
      age: currentTimeMs - click.processTimeMs,
    }));
}

/**
 * Get the duration of a recording from mouse move events
 *
 * @param moves Array of mouse move events
 * @returns Duration in milliseconds, or 0 if no events
 */
export function getRecordingDuration(moves: MouseMoveEvent[]): number {
  if (moves.length === 0) return 0;
  return moves[moves.length - 1].processTimeMs;
}

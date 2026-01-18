import type { Slice } from "../types/project";

/**
 * Calculate the output start time of a slice (sum of previous slice durations)
 */
export function calculateSliceOutputStart(
  slices: Slice[],
  index: number,
): number {
  let outputTime = 0;
  for (let i = 0; i < index; i++) {
    const slice = slices[i];
    const sourceDuration = slice.sourceEndMs - slice.sourceStartMs;
    const outputDuration = sourceDuration / slice.timeScale;
    outputTime += outputDuration;
  }
  return outputTime;
}

/**
 * Calculate the output duration of a single slice
 */
export function calculateSliceDuration(slice: Slice): number {
  const sourceDuration = slice.sourceEndMs - slice.sourceStartMs;
  return sourceDuration / slice.timeScale;
}

/**
 * Calculate total output duration of all slices
 */
export function calculateTotalDuration(slices: Slice[]): number {
  return slices.reduce((total, slice) => {
    return total + calculateSliceDuration(slice);
  }, 0);
}

/**
 * Convert output time to source time and slice index
 * Returns the slice index and the corresponding time in the source video
 */
export function outputTimeToSource(
  slices: Slice[],
  outputTimeMs: number,
): { sliceIndex: number; sourceTimeMs: number } {
  let accumulatedOutput = 0;

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const outputDuration = calculateSliceDuration(slice);

    if (outputTimeMs < accumulatedOutput + outputDuration) {
      // Found the slice containing this output time
      const offsetInSlice = outputTimeMs - accumulatedOutput;
      const sourceOffset = offsetInSlice * slice.timeScale;
      return {
        sliceIndex: i,
        sourceTimeMs: slice.sourceStartMs + sourceOffset,
      };
    }

    accumulatedOutput += outputDuration;
  }

  // Past end - return last slice end
  if (slices.length > 0) {
    const lastSlice = slices[slices.length - 1];
    return {
      sliceIndex: slices.length - 1,
      sourceTimeMs: lastSlice.sourceEndMs,
    };
  }

  return { sliceIndex: -1, sourceTimeMs: 0 };
}

/**
 * Convert source time within a slice to output time
 */
export function sourceTimeToOutput(
  slices: Slice[],
  sliceIndex: number,
  sourceTimeMs: number,
): number {
  if (sliceIndex < 0 || sliceIndex >= slices.length) {
    return 0;
  }

  let outputTime = calculateSliceOutputStart(slices, sliceIndex);

  const slice = slices[sliceIndex];
  const offsetInSource = sourceTimeMs - slice.sourceStartMs;
  outputTime += offsetInSource / slice.timeScale;

  return outputTime;
}

/**
 * Find which slice contains a given source time
 * Returns -1 if the source time is not within any slice
 */
export function findSliceAtSourceTime(
  slices: Slice[],
  sourceTimeMs: number,
): number {
  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    if (
      sourceTimeMs >= slice.sourceStartMs &&
      sourceTimeMs < slice.sourceEndMs
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Get computed render info for each slice
 */
export interface SliceRenderInfo {
  slice: Slice;
  index: number;
  outputStartMs: number;
  outputEndMs: number;
  outputDurationMs: number;
}

export function getSliceRenderInfos(slices: Slice[]): SliceRenderInfo[] {
  const result: SliceRenderInfo[] = [];
  let outputStart = 0;

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const outputDuration = calculateSliceDuration(slice);

    result.push({
      slice,
      index: i,
      outputStartMs: outputStart,
      outputEndMs: outputStart + outputDuration,
      outputDurationMs: outputDuration,
    });

    outputStart += outputDuration;
  }

  return result;
}

/**
 * Generate a unique ID for a new slice
 */
export function generateSliceId(): string {
  return `slice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a default slice covering the entire recording duration
 */
export function createDefaultSlice(durationMs: number): Slice {
  return {
    id: generateSliceId(),
    sourceStartMs: 0,
    sourceEndMs: durationMs,
    timeScale: 1,
    volume: 1,
    hideCursor: false,
    disableCursorSmoothing: false,
  };
}

/**
 * Validate that a slice has valid time boundaries
 */
export function isValidSlice(
  slice: Slice,
  minDurationMs: number = 100,
): boolean {
  return (
    slice.sourceStartMs >= 0 &&
    slice.sourceEndMs > slice.sourceStartMs &&
    slice.sourceEndMs - slice.sourceStartMs >= minDurationMs &&
    slice.timeScale > 0
  );
}

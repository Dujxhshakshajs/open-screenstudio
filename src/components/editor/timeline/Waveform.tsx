import { useEffect, useRef, useMemo, memo } from "react";
import type { WaveformData } from "../../../types/waveform";

interface WaveformProps {
  /** Waveform data from backend */
  data: WaveformData;
  /** Start time in source media (ms) - for trim visualization */
  sourceStartMs: number;
  /** End time in source media (ms) - for trim visualization */
  sourceEndMs: number;
  /** Width of the container in pixels */
  width: number;
  /** Height of the container in pixels */
  height: number;
  /** Waveform color */
  color?: string;
}

/**
 * Canvas-based waveform visualization component
 *
 * Renders audio waveform as a mirrored bar graph, showing only
 * the portion between sourceStartMs and sourceEndMs.
 */
function Waveform({
  data,
  sourceStartMs,
  sourceEndMs,
  width,
  height,
  color = "hsl(25 95% 53% / 0.5)",
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate which peaks to display based on trim
  const visiblePeaks = useMemo(() => {
    const { peaks, samplesPerSecond } = data;

    if (peaks.length === 0) {
      return [];
    }

    // Convert ms to peak indices
    const startIndex = Math.floor((sourceStartMs / 1000) * samplesPerSecond);
    const endIndex = Math.ceil((sourceEndMs / 1000) * samplesPerSecond);

    // Clamp to valid range
    const clampedStart = Math.max(0, startIndex);
    const clampedEnd = Math.min(peaks.length, endIndex);

    return peaks.slice(clampedStart, clampedEnd);
  }, [data, sourceStartMs, sourceEndMs]);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || visiblePeaks.length === 0 || width <= 0 || height <= 0)
      return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate bar width based on number of peaks and container width
    const barWidth = Math.max(width / visiblePeaks.length, 1);
    const centerY = height / 2;
    const maxBarHeight = height * 0.8; // 80% max height

    ctx.fillStyle = color;

    // Draw mirrored waveform (top and bottom from center)
    visiblePeaks.forEach((peak, index) => {
      const x = index * barWidth;
      const barHeight = peak * maxBarHeight;
      const halfHeight = barHeight / 2;

      // Draw bar from center extending up and down
      ctx.fillRect(
        x,
        centerY - halfHeight,
        Math.max(barWidth - 0.5, 0.5), // Small gap between bars
        barHeight || 1, // At least 1px for visibility
      );
    });
  }, [visiblePeaks, width, height, color]);

  if (visiblePeaks.length === 0) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
}

export default memo(Waveform);

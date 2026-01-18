import { useCallback, useEffect, memo } from "react";
import type { Slice } from "../../../types/project";
import { useEditorStore } from "../../../stores/editorStore";
import { useWaveformStore } from "../../../stores/waveformStore";
import Waveform from "./Waveform";
import {
  SLICE_MIN_WIDTH,
  SLICE_TRIM_HANDLE_WIDTH,
  SLICE_MIN_DURATION_MS,
  TIMELINE_TRACK_HEIGHT,
} from "./constants";

interface SliceItemProps {
  slice: Slice;
  index: number;
  pxPerMs: number;
  outputStartMs: number;
  outputDurationMs: number;
  onTrimStart: (newSourceStartMs: number) => void;
  onTrimEnd: (newSourceEndMs: number) => void;
  onSelect: () => void;
  /** Path to audio file for waveform display */
  audioPath?: string;
  /** Color for the waveform */
  waveformColor?: string;
}

/**
 * Format duration in ms to a short readable string
 */
function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toFixed(0).padStart(2, "0")}`;
}

function SliceItem({
  slice,
  index,
  pxPerMs,
  outputStartMs,
  outputDurationMs,
  onTrimStart,
  onTrimEnd,
  onSelect,
  audioPath,
  waveformColor = "rgba(255, 255, 255, 0.3)",
}: SliceItemProps) {
  const { selectedSliceId, activeTool } = useEditorStore();
  const { fetchWaveform, cache } = useWaveformStore();
  const isSelected = selectedSliceId === slice.id;

  // Fetch waveform data when audio path is available
  useEffect(() => {
    if (audioPath) {
      fetchWaveform(audioPath);
    }
  }, [audioPath, fetchWaveform]);

  // Get cached waveform data
  const waveformData = audioPath ? cache[audioPath] : null;

  // Calculate dimensions
  const width = outputDurationMs * pxPerMs;
  const left = outputStartMs * pxPerMs;

  // Calculate waveform display height (track height minus padding)
  const waveformHeight = TIMELINE_TRACK_HEIGHT - 8; // 4px padding top + 4px bottom

  // Show handles only if slice is wide enough
  const showHandles = width > SLICE_TRIM_HANDLE_WIDTH * 3;

  // Trim start handle
  const handleTrimStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const originalSourceStart = slice.sourceStartMs;
      const minSourceStart = 0;
      const maxSourceStart = slice.sourceEndMs - SLICE_MIN_DURATION_MS;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaMs = deltaX / pxPerMs;
        const newSourceStart = Math.max(
          minSourceStart,
          Math.min(
            originalSourceStart + deltaMs * slice.timeScale,
            maxSourceStart,
          ),
        );
        onTrimStart(newSourceStart);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [slice, pxPerMs, onTrimStart],
  );

  // Trim end handle
  const handleTrimEnd = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const originalSourceEnd = slice.sourceEndMs;
      const minSourceEnd = slice.sourceStartMs + SLICE_MIN_DURATION_MS;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaMs = deltaX / pxPerMs;
        const newSourceEnd = Math.max(
          minSourceEnd,
          originalSourceEnd + deltaMs * slice.timeScale,
        );
        onTrimEnd(newSourceEnd);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [slice, pxPerMs, onTrimEnd],
  );

  return (
    <button
      type="button"
      className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-pointer transition-all border-0 p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${
        isSelected
          ? "ring-2 ring-[hsl(var(--timeline-selection))] shadow-lg bg-[hsl(var(--timeline-slice-selected))]"
          : "hover:ring-1 hover:ring-[hsl(var(--timeline-selection))/50] bg-[hsl(var(--timeline-slice))]"
      }`}
      style={{
        left,
        width: Math.max(width, SLICE_MIN_WIDTH),
      }}
      onClick={onSelect}
    >
      {/* Left trim handle */}
      {showHandles && activeTool !== "split" && (
        <div
          role="slider"
          aria-label="Trim start"
          aria-valuenow={slice.sourceStartMs}
          tabIndex={0}
          className="absolute left-0 top-0 bottom-0 bg-foreground/10 hover:bg-foreground/30 cursor-ew-resize z-10 transition-colors"
          style={{ width: SLICE_TRIM_HANDLE_WIDTH }}
          onMouseDown={handleTrimStart}
          onKeyDown={(e) => {
            // Allow keyboard adjustment
            if (e.key === "ArrowLeft") {
              onTrimStart(slice.sourceStartMs - 100);
            } else if (e.key === "ArrowRight") {
              onTrimStart(slice.sourceStartMs + 100);
            }
          }}
        />
      )}

      {/* Waveform background */}
      {waveformData && (
        <Waveform
          data={waveformData}
          sourceStartMs={slice.sourceStartMs}
          sourceEndMs={slice.sourceEndMs}
          width={Math.max(width, SLICE_MIN_WIDTH)}
          height={waveformHeight}
          color={waveformColor}
        />
      )}

      {/* Slice content */}
      <div className="px-2 py-1 h-full flex flex-col justify-center overflow-hidden pointer-events-none relative z-[1]">
        <span className="text-xs font-medium text-foreground truncate drop-shadow-sm">
          Clip {index + 1}
        </span>
        <span className="text-[11px] text-foreground/60 truncate drop-shadow-sm">
          {formatDuration(outputDurationMs)}
        </span>
      </div>

      {/* Right trim handle */}
      {showHandles && activeTool !== "split" && (
        <div
          role="slider"
          aria-label="Trim end"
          aria-valuenow={slice.sourceEndMs}
          tabIndex={0}
          className="absolute right-0 top-0 bottom-0 bg-foreground/10 hover:bg-foreground/30 cursor-ew-resize z-10 transition-colors"
          style={{ width: SLICE_TRIM_HANDLE_WIDTH }}
          onMouseDown={handleTrimEnd}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              onTrimEnd(slice.sourceEndMs - 100);
            } else if (e.key === "ArrowRight") {
              onTrimEnd(slice.sourceEndMs + 100);
            }
          }}
        />
      )}

      {/* Speed indicator if not 1x */}
      {slice.timeScale !== 1 && (
        <div className="absolute bottom-1 right-2 text-[10px] bg-background/80 px-1 rounded text-foreground/80">
          {slice.timeScale}x
        </div>
      )}
    </button>
  );
}

export default memo(SliceItem);

import { useCallback, memo } from "react";
import type { Slice } from "../../../types/project";
import { useEditorStore } from "../../../stores/editorStore";

interface SliceItemProps {
  slice: Slice;
  index: number;
  pxPerMs: number;
  outputStartMs: number;
  outputDurationMs: number;
  onTrimStart: (newSourceStartMs: number) => void;
  onTrimEnd: (newSourceEndMs: number) => void;
  onSelect: () => void;
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
}: SliceItemProps) {
  const { selectedSliceId, activeTool } = useEditorStore();
  const isSelected = selectedSliceId === slice.id;

  // Calculate dimensions
  const width = outputDurationMs * pxPerMs;
  const left = outputStartMs * pxPerMs;

  // Minimum width for trim handles
  const minHandleWidth = 8;
  const showHandles = width > minHandleWidth * 3;

  // Trim start handle
  const handleTrimStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const originalSourceStart = slice.sourceStartMs;
      const minSourceStart = 0;
      const maxSourceStart = slice.sourceEndMs - 100; // Min 100ms duration

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
      const minSourceEnd = slice.sourceStartMs + 100; // Min 100ms duration

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
      className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-pointer transition-shadow border-0 p-0 text-left ${
        isSelected
          ? "ring-2 ring-blue-500 shadow-lg"
          : "hover:ring-1 hover:ring-blue-400"
      }`}
      style={{
        left,
        width: Math.max(width, 20), // Minimum visible width
        backgroundColor: "var(--accent)",
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
          className="absolute left-0 top-0 bottom-0 w-2 bg-white/20 hover:bg-white/40 cursor-ew-resize z-10"
          onMouseDown={handleTrimStart}
        />
      )}

      {/* Slice content */}
      <div className="px-2 py-1 h-full flex flex-col justify-center overflow-hidden pointer-events-none">
        <span className="text-xs font-medium text-white truncate">
          Clip {index + 1}
        </span>
        <span className="text-[10px] text-white/70 truncate">
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
          className="absolute right-0 top-0 bottom-0 w-2 bg-white/20 hover:bg-white/40 cursor-ew-resize z-10"
          onMouseDown={handleTrimEnd}
        />
      )}

      {/* Speed indicator if not 1x */}
      {slice.timeScale !== 1 && (
        <div className="absolute bottom-1 right-2 text-[9px] bg-black/50 px-1 rounded text-white">
          {slice.timeScale}x
        </div>
      )}
    </button>
  );
}

export default memo(SliceItem);

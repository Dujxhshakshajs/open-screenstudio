import { useCallback, useRef, useMemo } from "react";
import type { Slice, Layout } from "../../../types/project";
import { useEditorStore } from "../../../stores/editorStore";
import { useProjectStore } from "../../../stores/projectStore";
import {
  getSliceRenderInfos,
  calculateTotalDuration,
} from "../../../utils/sliceUtils";
import TimeRuler from "./TimeRuler";
import TimelineTrack from "./TimelineTrack";
import SliceItem from "./SliceItem";
import Playhead from "./Playhead";

interface TimelineProps {
  slices: Slice[];
  layouts: Layout[];
  currentTimeMs: number;
  onSeek: (timeMs: number) => void;
}

export default function Timeline({
  slices,
  layouts: _layouts, // Will be used in Phase 4 for LayoutTrack
  currentTimeMs,
  onSeek,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { timelineZoom, selectSlice, setActiveTool, activeTool } =
    useEditorStore();
  const { updateSlice, splitSlice, activeSceneIndex } = useProjectStore();

  // Calculate pixels per millisecond based on zoom
  // At zoom=1, aim for 100px per second
  const pxPerMs = useMemo(() => {
    const basePxPerMs = 0.1; // 100px per second
    return basePxPerMs * timelineZoom;
  }, [timelineZoom]);

  // Get computed render info for slices
  const sliceRenderInfos = useMemo(() => getSliceRenderInfos(slices), [slices]);

  // Total duration and width
  const totalDurationMs = useMemo(
    () => calculateTotalDuration(slices),
    [slices],
  );
  const totalWidth = Math.max(totalDurationMs * pxPerMs, 400);

  // Track height
  const trackHeight = 48;
  const rulerHeight = 24;
  const totalHeight = rulerHeight + trackHeight + 8; // Extra padding

  // Handle click on empty timeline area (seek)
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timeMs = Math.max(0, Math.min(x / pxPerMs, totalDurationMs));

      // If split tool is active, split the slice at this time
      if (activeTool === "split") {
        // Find which slice contains this time
        for (const info of sliceRenderInfos) {
          if (timeMs >= info.outputStartMs && timeMs < info.outputEndMs) {
            splitSlice(activeSceneIndex, info.slice.id, timeMs);
            return;
          }
        }
      }

      onSeek(timeMs);
    },
    [
      pxPerMs,
      totalDurationMs,
      activeTool,
      sliceRenderInfos,
      splitSlice,
      activeSceneIndex,
      onSeek,
    ],
  );

  // Handle slice trim start
  const handleTrimStart = useCallback(
    (sliceId: string, newSourceStartMs: number) => {
      updateSlice(activeSceneIndex, sliceId, {
        sourceStartMs: newSourceStartMs,
      });
    },
    [updateSlice, activeSceneIndex],
  );

  // Handle slice trim end
  const handleTrimEnd = useCallback(
    (sliceId: string, newSourceEndMs: number) => {
      updateSlice(activeSceneIndex, sliceId, { sourceEndMs: newSourceEndMs });
    },
    [updateSlice, activeSceneIndex],
  );

  return (
    <div className="flex flex-col bg-[--muted] border-t border-[--border]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[--border] bg-[--background]">
        <button
          type="button"
          className={`px-2 py-1 text-xs rounded ${
            activeTool === "select"
              ? "bg-blue-500 text-white"
              : "bg-[--muted] text-[--foreground] hover:bg-[--accent]"
          }`}
          onClick={() => setActiveTool("select")}
        >
          Select
        </button>
        <button
          type="button"
          className={`px-2 py-1 text-xs rounded ${
            activeTool === "split"
              ? "bg-blue-500 text-white"
              : "bg-[--muted] text-[--foreground] hover:bg-[--accent]"
          }`}
          onClick={() => setActiveTool("split")}
        >
          Split
        </button>
        <button
          type="button"
          className={`px-2 py-1 text-xs rounded ${
            activeTool === "trim"
              ? "bg-blue-500 text-white"
              : "bg-[--muted] text-[--foreground] hover:bg-[--accent]"
          }`}
          onClick={() => setActiveTool("trim")}
        >
          Trim
        </button>

        <div className="flex-1" />

        {/* Zoom controls */}
        <span className="text-xs text-[--foreground]/70">Zoom:</span>
        <button
          type="button"
          className="px-2 py-1 text-xs bg-[--muted] rounded hover:bg-[--accent]"
          onClick={() =>
            useEditorStore.getState().setTimelineZoom(timelineZoom / 1.5)
          }
        >
          -
        </button>
        <span className="text-xs w-10 text-center">
          {Math.round(timelineZoom * 100)}%
        </span>
        <button
          type="button"
          className="px-2 py-1 text-xs bg-[--muted] rounded hover:bg-[--accent]"
          onClick={() =>
            useEditorStore.getState().setTimelineZoom(timelineZoom * 1.5)
          }
        >
          +
        </button>
      </div>

      {/* Timeline content */}
      <div
        ref={containerRef}
        className="relative overflow-x-auto overflow-y-hidden"
        style={{ height: totalHeight }}
      >
        {/* Scrollable content */}
        <div
          className="relative"
          style={{ width: totalWidth, height: totalHeight }}
        >
          {/* Time ruler */}
          <TimeRuler
            durationMs={totalDurationMs}
            pxPerMs={pxPerMs}
            offsetX={0}
          />

          {/* Video track */}
          <button
            type="button"
            className="relative w-full text-left border-0 p-0 bg-transparent"
            style={{ cursor: activeTool === "split" ? "crosshair" : "pointer" }}
            onClick={handleTimelineClick}
            aria-label="Timeline track - click to seek or split"
          >
            <TimelineTrack label="Video" height={trackHeight}>
              {sliceRenderInfos.map((info) => (
                <SliceItem
                  key={info.slice.id}
                  slice={info.slice}
                  index={info.index}
                  pxPerMs={pxPerMs}
                  outputStartMs={info.outputStartMs}
                  outputDurationMs={info.outputDurationMs}
                  onTrimStart={(newStart) =>
                    handleTrimStart(info.slice.id, newStart)
                  }
                  onTrimEnd={(newEnd) => handleTrimEnd(info.slice.id, newEnd)}
                  onSelect={() => selectSlice(info.slice.id)}
                />
              ))}
            </TimelineTrack>
          </button>

          {/* Playhead */}
          <Playhead
            timeMs={currentTimeMs}
            pxPerMs={pxPerMs}
            height={totalHeight}
            onSeek={onSeek}
            totalDurationMs={totalDurationMs}
          />
        </div>
      </div>
    </div>
  );
}

import { useCallback, useRef, useMemo } from "react";
import { Scissors, MousePointer, Move } from "lucide-react";
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
import {
  TIMELINE_TRACK_HEIGHT,
  TIMELINE_RULER_HEIGHT,
  TIMELINE_PADDING,
  ZOOM_STEP,
  BASE_PX_PER_MS,
} from "./constants";

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
  const pxPerMs = useMemo(() => {
    return BASE_PX_PER_MS * timelineZoom;
  }, [timelineZoom]);

  // Get computed render info for slices
  const sliceRenderInfos = useMemo(() => getSliceRenderInfos(slices), [slices]);

  // Total duration and width
  const totalDurationMs = useMemo(
    () => calculateTotalDuration(slices),
    [slices],
  );
  const totalWidth = Math.max(totalDurationMs * pxPerMs, 400);

  // Calculate total height
  const totalHeight =
    TIMELINE_RULER_HEIGHT + TIMELINE_TRACK_HEIGHT + TIMELINE_PADDING;

  // Handle click on empty timeline area (seek)
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timeMs = Math.max(0, Math.min(x / pxPerMs, totalDurationMs));

      // If split tool is active, split the slice at this time
      if (activeTool === "split") {
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

  // Handle slice trim
  const handleTrimStart = useCallback(
    (sliceId: string, newSourceStartMs: number) => {
      updateSlice(activeSceneIndex, sliceId, {
        sourceStartMs: newSourceStartMs,
      });
    },
    [updateSlice, activeSceneIndex],
  );

  const handleTrimEnd = useCallback(
    (sliceId: string, newSourceEndMs: number) => {
      updateSlice(activeSceneIndex, sliceId, { sourceEndMs: newSourceEndMs });
    },
    [updateSlice, activeSceneIndex],
  );

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    useEditorStore.getState().setTimelineZoom(timelineZoom * ZOOM_STEP);
  }, [timelineZoom]);

  const handleZoomOut = useCallback(() => {
    useEditorStore.getState().setTimelineZoom(timelineZoom / ZOOM_STEP);
  }, [timelineZoom]);

  return (
    <div className="flex flex-col bg-[--muted] border-t border-[--border]">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[--border] bg-[--background]">
        {/* Tool buttons */}
        <button
          type="button"
          title="Select tool (V)"
          className={`p-1.5 rounded transition-colors ${
            activeTool === "select"
              ? "bg-[hsl(var(--timeline-selection))] text-white"
              : "text-[--foreground]/70 hover:bg-[--accent] hover:text-[--foreground]"
          }`}
          onClick={() => setActiveTool("select")}
        >
          <MousePointer className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Split tool (S)"
          className={`p-1.5 rounded transition-colors ${
            activeTool === "split"
              ? "bg-[hsl(var(--timeline-selection))] text-white"
              : "text-[--foreground]/70 hover:bg-[--accent] hover:text-[--foreground]"
          }`}
          onClick={() => setActiveTool("split")}
        >
          <Scissors className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Trim tool (T)"
          className={`p-1.5 rounded transition-colors ${
            activeTool === "trim"
              ? "bg-[hsl(var(--timeline-selection))] text-white"
              : "text-[--foreground]/70 hover:bg-[--accent] hover:text-[--foreground]"
          }`}
          onClick={() => setActiveTool("trim")}
        >
          <Move className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Zoom out"
            className="px-2 py-1 text-sm rounded text-[--foreground]/70 hover:bg-[--accent] hover:text-[--foreground] transition-colors"
            onClick={handleZoomOut}
          >
            -
          </button>
          <span className="text-xs text-[--foreground]/70 w-12 text-center tabular-nums">
            {Math.round(timelineZoom * 100)}%
          </span>
          <button
            type="button"
            title="Zoom in"
            className="px-2 py-1 text-sm rounded text-[--foreground]/70 hover:bg-[--accent] hover:text-[--foreground] transition-colors"
            onClick={handleZoomIn}
          >
            +
          </button>
        </div>
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
            <TimelineTrack label="Video" height={TIMELINE_TRACK_HEIGHT}>
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

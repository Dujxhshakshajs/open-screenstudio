import { useCallback, useRef, useMemo, useState } from "react";
import { Scissors, MousePointer, Move } from "lucide-react";
import type { Slice } from "../../../types/project";
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
  TIMELINE_LABEL_WIDTH,
  ZOOM_STEP,
  BASE_PX_PER_MS,
} from "./constants";

interface TimelineProps {
  screenSlices: Slice[];
  cameraSlices: Slice[];
  currentTimeMs: number;
  onSeek: (timeMs: number) => void;
  /** Path to system audio file for screen track waveform */
  systemAudioPath?: string;
  /** Path to microphone audio file for camera track waveform */
  micAudioPath?: string;
}

// Maximum height for the tracks container before scrolling
const MAX_TRACKS_HEIGHT = 300;

export default function Timeline({
  screenSlices,
  cameraSlices,
  currentTimeMs,
  onSeek,
  systemAudioPath,
  micAudioPath,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);
  const { timelineZoom, selectSlice, setActiveTool, activeTool } =
    useEditorStore();
  const { updateSlice, splitAllTracksAt, activeSceneIndex } = useProjectStore();

  // Split preview position (for showing the red line)
  const [splitPreviewX, setSplitPreviewX] = useState<number | null>(null);

  // Calculate pixels per millisecond based on zoom
  const pxPerMs = useMemo(() => {
    return BASE_PX_PER_MS * timelineZoom;
  }, [timelineZoom]);

  // Get computed render info for both tracks
  const screenRenderInfos = useMemo(
    () => getSliceRenderInfos(screenSlices),
    [screenSlices],
  );
  const cameraRenderInfos = useMemo(
    () => getSliceRenderInfos(cameraSlices),
    [cameraSlices],
  );

  // Total duration and width (use screen slices as reference since they're synced)
  const totalDurationMs = useMemo(
    () => calculateTotalDuration(screenSlices),
    [screenSlices],
  );
  const totalWidth = Math.max(totalDurationMs * pxPerMs, 400);

  // Calculate tracks height (screen + camera)
  const tracksContentHeight = TIMELINE_TRACK_HEIGHT * 2;
  const tracksHeight = Math.min(tracksContentHeight, MAX_TRACKS_HEIGHT);

  // Total timeline height (ruler + tracks container + padding)
  const totalHeight = TIMELINE_RULER_HEIGHT + tracksHeight + TIMELINE_PADDING;

  // Handle mouse move for split preview
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== "split") {
        setSplitPreviewX(null);
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (containerRef.current?.scrollLeft || 0);
      setSplitPreviewX(x);
    },
    [activeTool],
  );

  const handleMouseLeave = useCallback(() => {
    setSplitPreviewX(null);
  }, []);

  // Handle click on timeline area (seek or split)
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      // Get the click position relative to the scrollable content
      const container = containerRef.current;
      if (!container) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x =
        e.clientX - rect.left + container.scrollLeft - TIMELINE_LABEL_WIDTH;
      const timeMs = Math.max(0, Math.min(x / pxPerMs, totalDurationMs));

      // If split tool is active, split ALL tracks at this time (linked split)
      if (activeTool === "split") {
        // Split all tracks (screen, camera) at this time
        splitAllTracksAt(activeSceneIndex, timeMs);
        return;
      }

      onSeek(timeMs);
    },
    [
      pxPerMs,
      totalDurationMs,
      activeTool,
      splitAllTracksAt,
      activeSceneIndex,
      onSeek,
    ],
  );

  // Handle slice trim for a specific track
  const handleTrimStart = useCallback(
    (track: "screen" | "camera", sliceId: string, newSourceStartMs: number) => {
      updateSlice(activeSceneIndex, track, sliceId, {
        sourceStartMs: newSourceStartMs,
      });
    },
    [updateSlice, activeSceneIndex],
  );

  const handleTrimEnd = useCallback(
    (track: "screen" | "camera", sliceId: string, newSourceEndMs: number) => {
      updateSlice(activeSceneIndex, track, sliceId, {
        sourceEndMs: newSourceEndMs,
      });
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
    <div className="flex flex-col bg-muted border-t border-border">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-background">
        {/* Tool buttons */}
        <button
          type="button"
          title="Select tool (V)"
          className={`p-1.5 rounded transition-colors ${
            activeTool === "select"
              ? "bg-[hsl(var(--timeline-selection))] text-white"
              : "text-foreground/70 hover:bg-accent hover:text-foreground"
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
              : "text-foreground/70 hover:bg-accent hover:text-foreground"
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
              : "text-foreground/70 hover:bg-accent hover:text-foreground"
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
            className="px-2 py-1 text-sm rounded text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
            onClick={handleZoomOut}
          >
            -
          </button>
          <span className="text-xs text-foreground/70 w-12 text-center tabular-nums">
            {Math.round(timelineZoom * 100)}%
          </span>
          <button
            type="button"
            title="Zoom in"
            className="px-2 py-1 text-sm rounded text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
            onClick={handleZoomIn}
          >
            +
          </button>
        </div>
      </div>

      {/* Timeline content - horizontal scroll */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={containerRef}
        className="relative overflow-x-auto"
        style={{ height: totalHeight }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Scrollable content */}
        <div
          className="relative"
          style={{
            width: totalWidth + TIMELINE_LABEL_WIDTH,
            minHeight: totalHeight,
          }}
        >
          {/* Time ruler (with label spacer) */}
          <div className="flex">
            <div
              className="flex-shrink-0 bg-muted"
              style={{ width: TIMELINE_LABEL_WIDTH }}
            />
            <TimeRuler
              durationMs={totalDurationMs}
              pxPerMs={pxPerMs}
              offsetX={0}
            />
          </div>

          {/* Tracks container - vertical scroll if needed */}
          <div
            ref={tracksContainerRef}
            className="overflow-y-auto"
            style={{ maxHeight: MAX_TRACKS_HEIGHT }}
          >
            {/* Clickable tracks area */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
              className="relative"
              style={{
                cursor: activeTool === "split" ? "crosshair" : "pointer",
                minWidth: totalWidth + TIMELINE_LABEL_WIDTH,
              }}
              onClick={handleTimelineClick}
            >
              {/* Screen track */}
              <TimelineTrack label="Screen" height={TIMELINE_TRACK_HEIGHT}>
                {screenRenderInfos.map((info) => (
                  <SliceItem
                    key={info.slice.id}
                    slice={info.slice}
                    index={info.index}
                    pxPerMs={pxPerMs}
                    outputStartMs={info.outputStartMs}
                    outputDurationMs={info.outputDurationMs}
                    onTrimStart={(newStart) =>
                      handleTrimStart("screen", info.slice.id, newStart)
                    }
                    onTrimEnd={(newEnd) =>
                      handleTrimEnd("screen", info.slice.id, newEnd)
                    }
                    onSelect={() => selectSlice(info.slice.id)}
                    audioPath={systemAudioPath}
                    waveformColor="hsl(25 95% 53% / 0.6)"
                  />
                ))}
              </TimelineTrack>

              {/* Camera track */}
              <TimelineTrack label="Camera" height={TIMELINE_TRACK_HEIGHT}>
                {cameraRenderInfos.map((info) => (
                  <SliceItem
                    key={info.slice.id}
                    slice={info.slice}
                    index={info.index}
                    pxPerMs={pxPerMs}
                    outputStartMs={info.outputStartMs}
                    outputDurationMs={info.outputDurationMs}
                    onTrimStart={(newStart) =>
                      handleTrimStart("camera", info.slice.id, newStart)
                    }
                    onTrimEnd={(newEnd) =>
                      handleTrimEnd("camera", info.slice.id, newEnd)
                    }
                    onSelect={() => selectSlice(info.slice.id)}
                    audioPath={micAudioPath}
                    waveformColor="hsl(142 71% 45% / 0.5)"
                  />
                ))}
              </TimelineTrack>
            </div>
          </div>

          {/* Playhead - spans full height */}
          <Playhead
            timeMs={currentTimeMs}
            pxPerMs={pxPerMs}
            height={totalHeight}
            onSeek={onSeek}
            totalDurationMs={totalDurationMs}
            labelOffset={TIMELINE_LABEL_WIDTH}
          />

          {/* Split preview line */}
          {activeTool === "split" && splitPreviewX !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-30"
              style={{
                left: splitPreviewX,
                height: totalHeight,
              }}
            >
              {/* Top indicator */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

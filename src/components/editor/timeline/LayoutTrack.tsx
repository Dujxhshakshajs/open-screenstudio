import { memo, useCallback } from "react";
import { Monitor, Camera, Layout as LayoutIcon, Columns } from "lucide-react";
import type { Layout, LayoutType } from "../../../types/project";
import { useEditorStore } from "../../../stores/editorStore";
import { getLayoutTypeName } from "../../../utils/layoutUtils";
import { TIMELINE_TRACK_HEIGHT } from "./constants";

interface LayoutTrackProps {
  layouts: Layout[];
  pxPerMs: number;
  totalDurationMs: number;
  onLayoutSelect: (layoutId: string) => void;
  onLayoutUpdate: (layoutId: string, updates: Partial<Layout>) => void;
}

/**
 * Get icon for layout type
 */
function LayoutTypeIcon({ type }: { type: LayoutType }) {
  const className = "w-3 h-3";
  switch (type) {
    case "screen-only":
      return <Monitor className={className} />;
    case "camera-only":
      return <Camera className={className} />;
    case "side-by-side":
      return <Columns className={className} />;
    case "screen-with-camera":
    default:
      return <LayoutIcon className={className} />;
  }
}

/**
 * Get color for layout type
 */
function getLayoutColor(type: LayoutType): string {
  switch (type) {
    case "screen-only":
      return "hsl(var(--timeline-slice))";
    case "camera-only":
      return "hsl(217 91% 60% / 0.6)";
    case "side-by-side":
      return "hsl(142 76% 36% / 0.6)";
    case "screen-with-camera":
    default:
      return "hsl(280 65% 60% / 0.6)";
  }
}

interface LayoutItemProps {
  layout: Layout;
  pxPerMs: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateBoundary: (side: "start" | "end", newTimeMs: number) => void;
}

function LayoutItem({
  layout,
  pxPerMs,
  isSelected,
  onSelect,
  onUpdateBoundary,
}: LayoutItemProps) {
  const left = layout.startTime * pxPerMs;
  const width = (layout.endTime - layout.startTime) * pxPerMs;

  const handleBoundaryDrag = useCallback(
    (side: "start" | "end", e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const originalTime = side === "start" ? layout.startTime : layout.endTime;
      const minDuration = 100; // Min 100ms

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaMs = deltaX / pxPerMs;
        let newTime = originalTime + deltaMs;

        // Constrain based on side
        if (side === "start") {
          newTime = Math.max(
            0,
            Math.min(layout.endTime - minDuration, newTime),
          );
        } else {
          newTime = Math.max(layout.startTime + minDuration, newTime);
        }

        onUpdateBoundary(side, newTime);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [layout, pxPerMs, onUpdateBoundary],
  );

  return (
    <button
      type="button"
      className={`absolute top-1 bottom-1 rounded overflow-hidden cursor-pointer transition-all border-0 p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${
        isSelected ? "ring-2 ring-[hsl(var(--timeline-selection))]" : ""
      }`}
      style={{
        left,
        width: Math.max(width, 24),
        backgroundColor: getLayoutColor(layout.type),
      }}
      onClick={onSelect}
    >
      {/* Left boundary handle */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Layout start boundary"
        aria-valuenow={layout.startTime}
        className="absolute left-0 top-0 bottom-0 w-1.5 bg-[--foreground]/10 hover:bg-[--foreground]/30 cursor-ew-resize z-10"
        onMouseDown={(e) => handleBoundaryDrag("start", e)}
      />

      {/* Content */}
      <div className="px-2 h-full flex items-center gap-1 overflow-hidden pointer-events-none">
        <LayoutTypeIcon type={layout.type} />
        {width > 80 && (
          <span className="text-[10px] text-[--foreground]/80 truncate">
            {getLayoutTypeName(layout.type)}
          </span>
        )}
      </div>

      {/* Right boundary handle */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Layout end boundary"
        aria-valuenow={layout.endTime}
        className="absolute right-0 top-0 bottom-0 w-1.5 bg-[--foreground]/10 hover:bg-[--foreground]/30 cursor-ew-resize z-10"
        onMouseDown={(e) => handleBoundaryDrag("end", e)}
      />
    </button>
  );
}

const MemoizedLayoutItem = memo(LayoutItem);

export default function LayoutTrack({
  layouts,
  pxPerMs,
  totalDurationMs,
  onLayoutSelect,
  onLayoutUpdate,
}: LayoutTrackProps) {
  const { selectedLayoutId } = useEditorStore();
  const totalWidth = totalDurationMs * pxPerMs;

  const handleUpdateBoundary = useCallback(
    (layoutId: string, side: "start" | "end", newTimeMs: number) => {
      const updates =
        side === "start" ? { startTime: newTimeMs } : { endTime: newTimeMs };
      onLayoutUpdate(layoutId, updates);
    },
    [onLayoutUpdate],
  );

  return (
    <div className="flex border-b border-[--border]">
      {/* Track label */}
      <div
        className="flex-shrink-0 bg-[--muted] border-r border-[--border] px-2 flex items-center"
        style={{ width: 80, height: TIMELINE_TRACK_HEIGHT / 1.5 }}
      >
        <span className="text-xs text-[--foreground]/60 truncate">Layout</span>
      </div>

      {/* Track content */}
      <div
        className="relative flex-1 bg-[--background]"
        style={{ width: totalWidth, height: TIMELINE_TRACK_HEIGHT / 1.5 }}
      >
        {layouts.map((layout) => (
          <MemoizedLayoutItem
            key={layout.id}
            layout={layout}
            pxPerMs={pxPerMs}
            isSelected={selectedLayoutId === layout.id}
            onSelect={() => onLayoutSelect(layout.id)}
            onUpdateBoundary={(side, time) =>
              handleUpdateBoundary(layout.id, side, time)
            }
          />
        ))}
      </div>
    </div>
  );
}

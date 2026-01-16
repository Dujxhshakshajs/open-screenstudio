import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  ZoomIn,
  ZoomOut,
  Undo,
  Redo,
  Maximize,
} from "lucide-react";
import { useState } from "react";
import { useProjectStore } from "../../stores/projectStore";

export default function EditorView() {
  const { project } = useProjectStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, _setCurrentTime] = useState(0);
  const [duration, _setDuration] = useState(0);
  const [timelineZoom, setTimelineZoom] = useState(1);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
  };

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-2">No Project Open</h2>
          <p className="text-muted-foreground text-sm">
            Create a new recording or open an existing project to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Undo (Cmd+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-border mx-2" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Cut at Playhead (C)"
          >
            <Scissors className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Add Zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom Out Timeline"
            onClick={() => setTimelineZoom(Math.max(0.5, timelineZoom - 0.25))}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(timelineZoom * 100)}%
          </span>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom In Timeline"
            onClick={() => setTimelineZoom(Math.min(4, timelineZoom + 0.25))}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex">
        {/* Preview Panel */}
        <div className="flex-1 flex flex-col">
          {/* Video Preview */}
          <div className="flex-1 flex items-center justify-center bg-muted/30 p-4">
            <div className="relative w-full max-w-3xl aspect-video bg-black rounded-lg overflow-hidden">
              {/* Preview content will be rendered here */}
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  Video preview will be rendered here
                </p>
              </div>

              {/* Fullscreen button */}
              <button
                type="button"
                className="absolute top-2 right-2 p-1.5 rounded bg-black/50 hover:bg-black/70 text-white transition-colors"
                title="Fullscreen"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="h-14 border-t border-border flex items-center justify-center gap-4 px-4">
            <span className="text-xs font-mono text-muted-foreground w-20 text-right">
              {formatTime(currentTime)}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Previous Frame"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-3 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>

              <button
                type="button"
                className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Next Frame"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <span className="text-xs font-mono text-muted-foreground w-20">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-72 border-l border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-medium">Properties</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-4">
              {/* Cursor Settings */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Cursor
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-sm">
                    <span>Size</span>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      defaultValue="1.5"
                      className="w-24"
                    />
                  </label>
                  <label className="flex items-center justify-between text-sm">
                    <span>Smoothing</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </label>
                </div>
              </div>

              {/* Zoom Settings */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Auto Zoom
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-sm">
                    <span>Enabled</span>
                    <input type="checkbox" className="rounded" />
                  </label>
                  <label className="flex items-center justify-between text-sm">
                    <span>Level</span>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.5"
                      defaultValue="2"
                      className="w-24"
                    />
                  </label>
                </div>
              </div>

              {/* Background Settings */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Background
                </h4>
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      "#3F37C9",
                      "#F72585",
                      "#4CC9F0",
                      "#7209B7",
                      "#2D3748",
                      "#1A202C",
                      "#FFFFFF",
                      "#000000",
                    ].map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="w-full aspect-square rounded border border-border"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="h-32 border-t border-border bg-muted/30">
        <div className="h-full flex flex-col">
          {/* Timeline ruler */}
          <div className="h-6 border-b border-border flex items-end px-4">
            <div className="flex gap-16 text-[10px] text-muted-foreground">
              <span>0:00</span>
              <span>0:10</span>
              <span>0:20</span>
              <span>0:30</span>
              <span>0:40</span>
              <span>0:50</span>
              <span>1:00</span>
            </div>
          </div>

          {/* Timeline tracks */}
          <div className="flex-1 relative px-4 py-2">
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              style={{ left: "16px" }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-sm rotate-45" />
            </div>

            {/* Video track placeholder */}
            <div className="h-12 bg-muted rounded border border-border flex items-center px-2">
              <span className="text-xs text-muted-foreground">
                Video Track (segments will appear here)
              </span>
            </div>

            {/* Audio track placeholder */}
            <div className="h-8 mt-1 bg-muted/50 rounded border border-border flex items-center px-2">
              <span className="text-xs text-muted-foreground">Audio Track</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  Download,
  Film,
  Image,
  Globe,
  Monitor,
  Smartphone,
  Square,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";

type ExportFormat = "mp4" | "gif" | "webm";
type ExportQuality = "low" | "medium" | "high" | "lossless";
type ExportState = "idle" | "exporting" | "complete" | "error";

interface ExportPreset {
  id: string;
  name: string;
  description: string;
  icon: typeof Monitor;
  format: ExportFormat;
  quality: ExportQuality;
  resolution: string;
  fps: number;
}

const presets: ExportPreset[] = [
  {
    id: "web-hd",
    name: "Web HD",
    description: "Optimized for web sharing",
    icon: Globe,
    format: "mp4",
    quality: "high",
    resolution: "1920x1080",
    fps: 60,
  },
  {
    id: "social-media",
    name: "Social Media",
    description: "Great for Twitter/X, LinkedIn",
    icon: Smartphone,
    format: "mp4",
    quality: "medium",
    resolution: "1280x720",
    fps: 30,
  },
  {
    id: "4k",
    name: "4K Ultra HD",
    description: "Maximum quality",
    icon: Monitor,
    format: "mp4",
    quality: "lossless",
    resolution: "3840x2160",
    fps: 60,
  },
  {
    id: "gif",
    name: "Animated GIF",
    description: "For quick demos and docs",
    icon: Image,
    format: "gif",
    quality: "medium",
    resolution: "800x600",
    fps: 15,
  },
];

export default function ExportView() {
  const { project } = useProjectStore();
  const [selectedPreset, setSelectedPreset] = useState<string>("web-hd");
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [exportProgress, setExportProgress] = useState(0);

  // Custom settings (when not using preset)
  const [customFormat, setCustomFormat] = useState<ExportFormat>("mp4");
  const [customQuality, setCustomQuality] = useState<ExportQuality>("high");
  const [customResolution, setCustomResolution] = useState("1920x1080");
  const [customFps, setCustomFps] = useState(60);
  const [useCustom, setUseCustom] = useState(false);

  const handleExport = async () => {
    setExportState("exporting");
    setExportProgress(0);

    // Simulate export progress
    // TODO: Replace with actual Tauri export
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setExportState("complete");
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  const handleCancel = () => {
    setExportState("idle");
    setExportProgress(0);
    // TODO: Cancel actual export via Tauri
  };

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Download className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-2">No Project Open</h2>
          <p className="text-muted-foreground text-sm">
            Create a new recording or open an existing project to export
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Export Presets */}
          <div>
            <h2 className="text-lg font-medium mb-4">Export Settings</h2>
            <div className="grid grid-cols-2 gap-4">
              {presets.map((preset) => {
                const Icon = preset.icon;
                const isSelected = !useCustom && selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(preset.id);
                      setUseCustom(false);
                    }}
                    disabled={exportState === "exporting"}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? "border-foreground bg-accent"
                        : "border-border hover:border-foreground/50 hover:bg-muted/50"
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 mt-0.5 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium">{preset.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {preset.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {preset.format.toUpperCase()} • {preset.resolution} •{" "}
                          {preset.fps}fps
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Settings */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="useCustom"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
                disabled={exportState === "exporting"}
                className="rounded"
              />
              <label htmlFor="useCustom" className="text-sm font-medium">
                Use custom settings
              </label>
            </div>

            {useCustom && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label
                    htmlFor="export-format"
                    className="text-sm font-medium block mb-1"
                  >
                    Format
                  </label>
                  <select
                    id="export-format"
                    value={customFormat}
                    onChange={(e) =>
                      setCustomFormat(e.target.value as ExportFormat)
                    }
                    disabled={exportState === "exporting"}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="mp4">MP4 (H.264)</option>
                    <option value="webm">WebM (VP9)</option>
                    <option value="gif">GIF</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="export-quality"
                    className="text-sm font-medium block mb-1"
                  >
                    Quality
                  </label>
                  <select
                    id="export-quality"
                    value={customQuality}
                    onChange={(e) =>
                      setCustomQuality(e.target.value as ExportQuality)
                    }
                    disabled={exportState === "exporting"}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="low">Low (smaller file)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="lossless">Lossless (largest file)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="export-resolution"
                    className="text-sm font-medium block mb-1"
                  >
                    Resolution
                  </label>
                  <select
                    id="export-resolution"
                    value={customResolution}
                    onChange={(e) => setCustomResolution(e.target.value)}
                    disabled={exportState === "exporting"}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="3840x2160">4K (3840x2160)</option>
                    <option value="1920x1080">1080p (1920x1080)</option>
                    <option value="1280x720">720p (1280x720)</option>
                    <option value="854x480">480p (854x480)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="export-fps"
                    className="text-sm font-medium block mb-1"
                  >
                    Frame Rate
                  </label>
                  <select
                    id="export-fps"
                    value={customFps}
                    onChange={(e) => setCustomFps(Number(e.target.value))}
                    disabled={exportState === "exporting"}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="60">60 fps</option>
                    <option value="30">30 fps</option>
                    <option value="24">24 fps</option>
                    <option value="15">15 fps (GIF)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Preview Summary */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Export Summary</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project</span>
                <span>{project.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span>
                  {Math.round(
                    (project.config.recordingRange[1] -
                      project.config.recordingRange[0]) /
                      1000
                  )}
                  s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Format</span>
                <span>
                  {useCustom
                    ? customFormat.toUpperCase()
                    : presets
                        .find((p) => p.id === selectedPreset)
                        ?.format.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resolution</span>
                <span>
                  {useCustom
                    ? customResolution
                    : presets.find((p) => p.id === selectedPreset)?.resolution}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Footer */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto">
          {exportState === "idle" && (
            <button
              type="button"
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 bg-foreground text-background py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              <Film className="w-5 h-5" />
              Export Video
            </button>
          )}

          {exportState === "exporting" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Exporting...</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {exportProgress}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="w-full flex items-center justify-center gap-2 border border-border py-2 rounded-lg text-sm hover:bg-muted transition-colors"
              >
                <Square className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}

          {exportState === "complete" && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-green-500">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Export Complete!</span>
              </div>
              <button
                type="button"
                onClick={() => setExportState("idle")}
                className="w-full flex items-center justify-center gap-2 bg-foreground text-background py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <Film className="w-5 h-5" />
                Export Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

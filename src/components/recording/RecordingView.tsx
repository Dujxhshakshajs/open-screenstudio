import { useState } from "react";
import {
  Circle,
  Square,
  Pause,
  Play,
  Monitor,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Settings,
} from "lucide-react";

type RecordingState = "idle" | "recording" | "paused";

interface SourceOption {
  id: string;
  name: string;
  type: "display" | "window";
}

export default function RecordingView() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);

  // Mock sources - will be populated from Tauri
  const sources: SourceOption[] = [
    { id: "display-1", name: "Main Display", type: "display" },
    { id: "display-2", name: "External Display", type: "display" },
  ];

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = () => {
    if (!selectedSource) return;
    setRecordingState("recording");
    // TODO: Start actual recording via Tauri
  };

  const handleStopRecording = () => {
    setRecordingState("idle");
    setRecordingTime(0);
    // TODO: Stop recording via Tauri
  };

  const handlePauseRecording = () => {
    setRecordingState("paused");
    // TODO: Pause recording via Tauri
  };

  const handleResumeRecording = () => {
    setRecordingState("recording");
    // TODO: Resume recording via Tauri
  };

  return (
    <div className="h-full flex flex-col">
      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center bg-muted/30 p-8">
        <div className="w-full max-w-4xl aspect-video bg-black/50 rounded-lg border border-border flex items-center justify-center relative overflow-hidden">
          {selectedSource ? (
            <div className="text-muted-foreground text-sm">
              Preview of {sources.find((s) => s.id === selectedSource)?.name}
              <br />
              <span className="text-xs">(Preview will be implemented)</span>
            </div>
          ) : (
            <div className="text-center">
              <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Select a source to record</p>
            </div>
          )}

          {/* Recording indicator */}
          {recordingState !== "idle" && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full">
              <div
                className={`w-3 h-3 rounded-full ${
                  recordingState === "recording"
                    ? "bg-red-500 animate-pulse"
                    : "bg-yellow-500"
                }`}
              />
              <span className="text-white text-sm font-mono">
                {formatTime(recordingTime)}
              </span>
            </div>
          )}

          {/* Camera preview placeholder */}
          {cameraEnabled && selectedSource && (
            <div className="absolute bottom-4 right-4 w-32 aspect-video bg-muted rounded-lg border border-border flex items-center justify-center">
              <Camera className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-border bg-background p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Source Selection */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <select
                value={selectedSource || ""}
                onChange={(e) => setSelectedSource(e.target.value || null)}
                disabled={recordingState !== "idle"}
                className="bg-muted border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Select source...</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Audio/Video toggles */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMicEnabled(!micEnabled)}
                disabled={recordingState !== "idle"}
                className={`p-2 rounded-md transition-colors ${
                  micEnabled
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted"
                } disabled:opacity-50`}
                title={micEnabled ? "Disable Microphone" : "Enable Microphone"}
              >
                {micEnabled ? (
                  <Mic className="w-4 h-4" />
                ) : (
                  <MicOff className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setCameraEnabled(!cameraEnabled)}
                disabled={recordingState !== "idle"}
                className={`p-2 rounded-md transition-colors ${
                  cameraEnabled
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted"
                } disabled:opacity-50`}
                title={cameraEnabled ? "Disable Camera" : "Enable Camera"}
              >
                {cameraEnabled ? (
                  <Camera className="w-4 h-4" />
                ) : (
                  <CameraOff className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSystemAudioEnabled(!systemAudioEnabled)}
                disabled={recordingState !== "idle"}
                className={`p-2 rounded-md transition-colors ${
                  systemAudioEnabled
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted"
                } disabled:opacity-50`}
                title={
                  systemAudioEnabled
                    ? "Disable System Audio"
                    : "Enable System Audio"
                }
              >
                {systemAudioEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                className="p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                title="Recording Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Record Controls */}
          <div className="flex items-center gap-2">
            {recordingState === "idle" && (
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={!selectedSource}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                <Circle className="w-4 h-4 fill-current" />
                <span>Start Recording</span>
              </button>
            )}

            {recordingState === "recording" && (
              <>
                <button
                  type="button"
                  onClick={handlePauseRecording}
                  className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-lg transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {recordingState === "paused" && (
              <>
                <button
                  type="button"
                  onClick={handleResumeRecording}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Resume</span>
                </button>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-lg transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

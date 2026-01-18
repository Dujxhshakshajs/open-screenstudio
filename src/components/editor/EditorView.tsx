import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Loader2,
  Download,
} from "lucide-react";
import ExportDialog from "../export/ExportDialog";
import { useProjectStore } from "../../stores/projectStore";
import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { CursorOverlay } from "./CursorOverlay";
import { ClickIndicator } from "./ClickIndicator";
import { WebcamOverlay } from "./WebcamOverlay";
import {
  CursorSmoother,
  type SmoothedPosition,
} from "../../processing/cursorSmoothing";
import {
  DEFAULT_SPRING_CONFIG,
  type SpringConfig,
} from "../../processing/spring";
import type {
  RecordingBundle,
  MouseMoveEvent,
  MouseClickEvent,
  CursorInfo,
} from "../../types/recording";
import {
  findCursorAtTime,
  findCursorAtTimeInterpolated,
  findRecentClicks,
} from "../../utils/recordingPlayback";

export default function EditorView() {
  const { project } = useProjectStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Recording data
  const [recordingPath, setRecordingPath] = useState<string | null>(null);
  const [recordingBundle, setRecordingBundle] =
    useState<RecordingBundle | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [webcamSrc, setWebcamSrc] = useState<string | null>(null);
  const [micAudioSrc, setMicAudioSrc] = useState<string | null>(null);
  const [systemAudioSrc, setSystemAudioSrc] = useState<string | null>(null);
  const [isLoadingRecording, setIsLoadingRecording] = useState(true);

  // Refs for media elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const micAudioRef = useRef<HTMLAudioElement>(null);
  const systemAudioRef = useRef<HTMLAudioElement>(null);

  // Cursor smoothing state
  // cursorSize is a multiplier on top of the natural cursor size
  // 1.0 = same size as during recording, 1.5 = 50% larger for emphasis
  // DEBUG: Using larger size (3.0) to make cursor visible for debugging
  const [cursorSize] = useState(3.0);
  const [smoothingEnabled] = useState(true);
  const [springConfig] = useState<SpringConfig>(DEFAULT_SPRING_CONFIG);
  const [cursorPosition, setCursorPosition] = useState<SmoothedPosition | null>(
    null,
  );
  const [recentClicks, setRecentClicks] = useState<
    Array<MouseClickEvent & { age: number }>
  >([]);

  // Refs for animation
  const smootherRef = useRef<CursorSmoother | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastAnimationTimeRef = useRef<number>(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ width: 800, height: 450 });

  // Helper to update cursor position at a specific time (used for initial load and seeking while paused)
  const updateCursorForTime = useCallback(
    (timeMs: number, resetSmoother: boolean = false) => {
      if (!recordingBundle?.mouseMoves?.length) {
        return;
      }

      const cursorAtTime = findCursorAtTimeInterpolated(
        recordingBundle.mouseMoves,
        timeMs,
      );

      if (cursorAtTime) {
        if (resetSmoother && smootherRef.current) {
          smootherRef.current.reset(cursorAtTime.x, cursorAtTime.y);
        }

        if (smootherRef.current && smoothingEnabled) {
          const newPosition = smootherRef.current.update(
            {
              x: cursorAtTime.x,
              y: cursorAtTime.y,
              cursorId: cursorAtTime.cursorId,
              processTimeMs: timeMs,
            },
            0, // No delta time for instant update
          );
          setCursorPosition(newPosition);
        } else {
          setCursorPosition({
            x: cursorAtTime.x,
            y: cursorAtTime.y,
            rawX: cursorAtTime.x,
            rawY: cursorAtTime.y,
            cursorId: cursorAtTime.cursorId,
          });
        }
      }
    },
    [recordingBundle?.mouseMoves, smoothingEnabled],
  );

  // Initialize cursor smoother
  useEffect(() => {
    if (smoothingEnabled) {
      smootherRef.current = new CursorSmoother(springConfig);
    } else {
      smootherRef.current = null;
    }
  }, [smoothingEnabled, springConfig]);

  // Load recording bundle from URL params
  useEffect(() => {
    const loadRecording = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const recording = urlParams.get("recording");

      if (!recording) {
        setIsLoadingRecording(false);
        return;
      }

      setIsLoadingRecording(true);
      setRecordingPath(recording);

      try {
        // Load the complete recording bundle
        const bundle = await invoke<RecordingBundle>("load_recording_bundle", {
          bundlePath: recording,
        });

        setRecordingBundle(bundle);
        setDuration(bundle.videoMetadata.durationMs);

        // Convert paths to asset URLs
        setVideoSrc(convertFileSrc(bundle.videoPath));

        if (bundle.webcamVideoPath) {
          setWebcamSrc(convertFileSrc(bundle.webcamVideoPath));
        }
        if (bundle.micAudioPath) {
          setMicAudioSrc(convertFileSrc(bundle.micAudioPath));
        }
        if (bundle.systemAudioPath) {
          setSystemAudioSrc(convertFileSrc(bundle.systemAudioPath));
        }

        console.log("Loaded recording bundle:", {
          path: recording,
          mouseMoves: bundle.mouseMoves.length,
          mouseClicks: bundle.mouseClicks.length,
          cursors: Object.keys(bundle.cursors).length,
          metadata: bundle.videoMetadata,
        });
      } catch (err) {
        console.error("Failed to load recording:", err);
      } finally {
        setIsLoadingRecording(false);
      }
    };

    loadRecording();
  }, []);

  // Set initial cursor position when recording bundle loads
  useEffect(() => {
    if (!recordingBundle?.mouseMoves?.length) {
      return;
    }

    // Get the initial cursor position at time 0
    updateCursorForTime(0, true);
  }, [recordingBundle, updateCursorForTime]);

  // Update cursor position when seeking while paused
  useEffect(() => {
    // Only run when paused - animation loop handles playback
    if (isPlaying) {
      return;
    }

    if (!recordingBundle?.mouseMoves?.length) {
      return;
    }

    updateCursorForTime(currentTime, true);
  }, [
    currentTime,
    isPlaying,
    recordingBundle?.mouseMoves,
    updateCursorForTime,
  ]);

  // Measure preview container size
  useEffect(() => {
    const updateSize = () => {
      if (previewRef.current) {
        const rect = previewRef.current.getBoundingClientRect();
        setPreviewSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Cursor playback animation loop
  useEffect(() => {
    if (!isPlaying || !recordingBundle) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastAnimationTimeRef.current = 0;
      return;
    }

    // When playback starts, ensure smoother is initialized at current cursor position
    const videoTime = videoRef.current
      ? videoRef.current.currentTime * 1000
      : 0;
    const initialCursor = findCursorAtTime(
      recordingBundle.mouseMoves,
      videoTime,
    );
    if (initialCursor && smootherRef.current) {
      console.log("Playback starting: resetting smoother to", {
        x: initialCursor.x,
        y: initialCursor.y,
        videoTime,
      });
      smootherRef.current.reset(initialCursor.x, initialCursor.y);
    }

    const animate = (timestamp: number) => {
      if (!lastAnimationTimeRef.current) {
        lastAnimationTimeRef.current = timestamp;
      }
      const deltaMs = Math.min(timestamp - lastAnimationTimeRef.current, 100);
      lastAnimationTimeRef.current = timestamp;

      // Get current time from video element
      const videoTime = videoRef.current
        ? videoRef.current.currentTime * 1000
        : 0;

      // Find cursor position at current time
      const cursorAtTime = findCursorAtTime(
        recordingBundle.mouseMoves,
        videoTime,
      );

      if (cursorAtTime) {
        const rawMove: MouseMoveEvent = cursorAtTime;

        // Apply smoothing if enabled
        let newPosition: SmoothedPosition;
        if (smootherRef.current && smoothingEnabled) {
          newPosition = smootherRef.current.update(
            {
              x: rawMove.x,
              y: rawMove.y,
              cursorId: rawMove.cursorId,
              processTimeMs: rawMove.processTimeMs,
            },
            deltaMs / 1000,
          );
        } else {
          newPosition = {
            x: rawMove.x,
            y: rawMove.y,
            rawX: rawMove.x,
            rawY: rawMove.y,
            cursorId: rawMove.cursorId,
          };
        }

        // Debug: log when smoothed position differs significantly from raw
        const diff = Math.sqrt(
          Math.pow(newPosition.x - newPosition.rawX, 2) +
            Math.pow(newPosition.y - newPosition.rawY, 2),
        );
        if (diff > 50) {
          console.warn("Animation loop: large smoothing diff", {
            videoTime,
            deltaMs,
            raw: { x: newPosition.rawX, y: newPosition.rawY },
            smoothed: { x: newPosition.x, y: newPosition.y },
            diff,
          });
        }

        setCursorPosition(newPosition);
      }

      // Find recent clicks for visualization
      const clicks = findRecentClicks(
        recordingBundle.mouseClicks,
        videoTime,
        500,
      );
      setRecentClicks(clicks);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, recordingBundle, smoothingEnabled]);

  // Sync audio with video
  const syncAudio = useCallback(() => {
    if (!videoRef.current) return;

    const videoTime = videoRef.current.currentTime;

    if (micAudioRef.current) {
      const diff = Math.abs(micAudioRef.current.currentTime - videoTime);
      if (diff > 0.1) {
        micAudioRef.current.currentTime = videoTime;
      }
    }

    if (systemAudioRef.current) {
      const diff = Math.abs(systemAudioRef.current.currentTime - videoTime);
      if (diff > 0.1) {
        systemAudioRef.current.currentTime = videoTime;
      }
    }
  }, []);

  // Handle play/pause
  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      micAudioRef.current?.pause();
      systemAudioRef.current?.pause();
    } else {
      syncAudio();
      await videoRef.current.play();
      micAudioRef.current?.play();
      systemAudioRef.current?.play();
    }
  }, [isPlaying, syncAudio]);

  // Handle seeking on timeline
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || duration === 0) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = percentage * duration;

      // Update video time
      if (videoRef.current) {
        videoRef.current.currentTime = newTime / 1000;
      }

      // Sync audio
      if (micAudioRef.current) {
        micAudioRef.current.currentTime = newTime / 1000;
      }
      if (systemAudioRef.current) {
        systemAudioRef.current.currentTime = newTime / 1000;
      }

      setCurrentTime(newTime);

      // Reset smoother on seek
      if (smootherRef.current && recordingBundle) {
        const cursorAtTime = findCursorAtTime(
          recordingBundle.mouseMoves,
          newTime,
        );
        if (cursorAtTime) {
          smootherRef.current.reset(cursorAtTime.x, cursorAtTime.y);
        }
      }
    },
    [duration, recordingBundle],
  );

  // Handle frame stepping
  const handleFrameStep = useCallback(
    (direction: "back" | "forward") => {
      if (!videoRef.current || !recordingBundle) return;

      const frameTime = 1000 / recordingBundle.videoMetadata.fps;
      const newTime =
        currentTime + (direction === "forward" ? frameTime : -frameTime);
      const clampedTime = Math.max(0, Math.min(duration, newTime));

      videoRef.current.currentTime = clampedTime / 1000;
      setCurrentTime(clampedTime);
    },
    [currentTime, duration, recordingBundle],
  );

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Get cursors from bundle or use empty object
  const cursors: Record<string, CursorInfo> = recordingBundle?.cursors || {};
  const videoWidth = recordingBundle?.videoMetadata.width || 1920;
  const videoHeight = recordingBundle?.videoMetadata.height || 1080;

  // Calculate playhead position percentage
  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#333]">
        <span className="text-sm text-white/60">
          {project?.name || "Untitled Recording"}
        </span>
        <button
          type="button"
          onClick={() => setShowExportDialog(true)}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div
          ref={previewRef}
          className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl"
        >
          {/* Loading state */}
          {isLoadingRecording && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-white/50" />
            </div>
          )}

          {/* Video element */}
          {videoSrc && !isLoadingRecording && (
            <video
              ref={videoRef}
              src={videoSrc}
              className="absolute inset-0 w-full h-full object-contain"
              onTimeUpdate={(e) =>
                setCurrentTime(e.currentTarget.currentTime * 1000)
              }
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onSeeked={syncAudio}
            >
              <track kind="captions" />
            </video>
          )}

          {/* Hidden audio elements */}
          {micAudioSrc && (
            <audio ref={micAudioRef} src={micAudioSrc} preload="auto">
              <track kind="captions" />
            </audio>
          )}
          {systemAudioSrc && (
            <audio ref={systemAudioRef} src={systemAudioSrc} preload="auto">
              <track kind="captions" />
            </audio>
          )}

          {/* No recording message */}
          {!videoSrc && !isLoadingRecording && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/50 text-lg">
                {recordingPath
                  ? "Failed to load recording"
                  : "No recording loaded"}
              </p>
            </div>
          )}

          {/* Webcam Overlay */}
          {webcamSrc && recordingBundle && (
            <WebcamOverlay
              webcamSrc={webcamSrc}
              currentTimeMs={currentTime}
              isPlaying={isPlaying}
              videoWidth={videoWidth}
              videoHeight={videoHeight}
              containerWidth={previewSize.width}
              containerHeight={previewSize.height}
            />
          )}

          {/* Click Indicator */}
          {recordingBundle && (
            <ClickIndicator
              clicks={recentClicks}
              videoWidth={videoWidth}
              videoHeight={videoHeight}
              containerWidth={previewSize.width}
              containerHeight={previewSize.height}
            />
          )}

          {/* Cursor Overlay */}
          {recordingBundle && (
            <CursorOverlay
              position={cursorPosition}
              cursors={cursors}
              cursorSize={cursorSize}
              videoWidth={videoWidth}
              videoHeight={videoHeight}
              containerWidth={previewSize.width}
              containerHeight={previewSize.height}
            />
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-[#252525] border-t border-[#333]">
        {/* Timeline */}
        <div
          ref={timelineRef}
          role="slider"
          aria-label="Timeline"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          tabIndex={0}
          className="h-12 relative cursor-pointer mx-4 my-2"
          onClick={handleTimelineClick}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") handleFrameStep("back");
            else if (e.key === "ArrowRight") handleFrameStep("forward");
          }}
        >
          {/* Timeline track */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-[#333] rounded-full overflow-hidden">
            {/* Progress */}
            <div
              className="h-full bg-white/30 rounded-full"
              style={{ width: `${playheadPosition}%` }}
            />
          </div>

          {/* Playhead */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg -ml-2"
            style={{ left: `${playheadPosition}%` }}
          />
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-6 pb-4">
          {/* Time display */}
          <span className="text-white/60 text-sm font-mono w-20 text-right">
            {formatTime(currentTime)}
          </span>

          {/* Control buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleFrameStep("back")}
              className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Previous Frame"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handlePlayPause}
              disabled={!videoSrc}
              className="p-4 rounded-full bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleFrameStep("forward")}
              className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Next Frame"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Duration display */}
          <span className="text-white/60 text-sm font-mono w-20">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        recordingPath={recordingPath}
        projectName={project?.name || "Untitled Recording"}
        durationMs={duration}
      />
    </div>
  );
}

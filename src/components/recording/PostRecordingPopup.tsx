import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { Save, Edit3, X, Film, Loader2 } from "lucide-react";
import type { RecordingResult, VideoMetadata } from "../../types/recording";

interface PostRecordingPopupProps {
  recordingResult: RecordingResult;
  onSave: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}

export default function PostRecordingPopup({
  recordingResult,
  onSave,
  onEdit,
  onDismiss,
}: PostRecordingPopupProps) {
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(
    null,
  );
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

  // Find the video file from output files
  const videoFile = recordingResult.outputFiles.find((f) => f.endsWith(".mp4"));
  const videoSrc = videoFile ? convertFileSrc(videoFile) : null;

  // Debug logging
  useEffect(() => {
    console.log("PostRecordingPopup - recordingResult:", recordingResult);
    console.log("PostRecordingPopup - videoFile:", videoFile);
    console.log("PostRecordingPopup - videoSrc:", videoSrc);
  }, [recordingResult, videoFile, videoSrc]);

  // Load video metadata on mount
  useEffect(() => {
    const loadMetadata = async () => {
      if (!videoFile) {
        setIsLoadingMetadata(false);
        return;
      }

      try {
        const metadata = await invoke<VideoMetadata>("get_video_metadata", {
          path: videoFile,
        });
        setVideoMetadata(metadata);
      } catch (err) {
        console.error("Failed to load video metadata:", err);
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    loadMetadata();
  }, [videoFile]);

  // Format duration
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Format resolution (e.g., 1920x1080 -> "1080p")
  const formatResolution = (_width: number, height: number) => {
    if (height >= 2160) return "4K";
    if (height >= 1440) return "1440p";
    if (height >= 1080) return "1080p";
    if (height >= 720) return "720p";
    if (height >= 480) return "480p";
    return `${height}p`;
  };

  // Loop video at 5 seconds
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (e.currentTarget.currentTime >= 5) {
      e.currentTarget.currentTime = 0;
    }
  };

  // Calculate preview dimensions based on aspect ratio
  const getPreviewDimensions = () => {
    const maxWidth = 240;
    const maxHeight = 135;

    if (!videoMetadata) {
      return { width: maxWidth, height: maxHeight };
    }

    const aspectRatio = videoMetadata.width / videoMetadata.height;

    if (aspectRatio > maxWidth / maxHeight) {
      // Video is wider - constrain by width
      return { width: maxWidth, height: Math.round(maxWidth / aspectRatio) };
    } else {
      // Video is taller - constrain by height
      return { width: Math.round(maxHeight * aspectRatio), height: maxHeight };
    }
  };

  const previewDimensions = getPreviewDimensions();

  // Build info string
  const getInfoString = () => {
    const parts = ["MP4"];

    if (videoMetadata) {
      parts.push(formatResolution(videoMetadata.width, videoMetadata.height));
      parts.push(`${Math.round(videoMetadata.fps)}fps`);
    }

    parts.push(formatDuration(recordingResult.totalDurationMs));

    return parts.join(" \u2022 ");
  };

  return (
    <div className="popup-container">
      <div className="popup-content">
        {/* Video Preview */}
        <div
          className="popup-preview"
          style={{
            width: previewDimensions.width,
            height: previewDimensions.height,
          }}
        >
          {isLoadingMetadata ? (
            <div className="popup-video-placeholder">
              <Loader2 className="w-6 h-6 animate-spin opacity-50" />
            </div>
          ) : videoSrc ? (
            <video
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onError={(e) => {
                console.error("Video error:", e);
                console.error("Video error details:", e.currentTarget.error);
              }}
              onLoadStart={() => console.log("Video load started")}
              onLoadedData={() => console.log("Video data loaded")}
              onCanPlay={() => console.log("Video can play")}
              className="popup-video"
            />
          ) : (
            <div className="popup-video-placeholder">
              <Film className="w-8 h-8 opacity-50" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="popup-actions">
          <button
            type="button"
            onClick={onSave}
            className="popup-btn popup-btn-disabled"
            disabled
            title="Coming soon"
          >
            <Save className="w-4 h-4" />
            <span>Save...</span>
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="popup-btn popup-btn-primary"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit</span>
          </button>
        </div>

        {/* Info */}
        <div className="popup-info">
          <span>{getInfoString()}</span>
        </div>

        {/* Close */}
        <button type="button" onClick={onDismiss} className="popup-close">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

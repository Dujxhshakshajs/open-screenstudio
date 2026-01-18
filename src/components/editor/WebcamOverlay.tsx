/**
 * WebcamOverlay - Renders the webcam video overlay on top of the screen recording preview
 *
 * Displays the webcam video in the bottom-right corner, scaled to 1/8 of the video width
 * while maintaining the webcam's aspect ratio. Features rounded corners.
 */

import { useRef, useEffect, useState } from "react";

interface WebcamOverlayProps {
  /** URL to the webcam video source */
  webcamSrc: string;
  /** Current playback time in milliseconds */
  currentTimeMs: number;
  /** Whether video is currently playing */
  isPlaying: boolean;
  /** Screen video dimensions for positioning */
  videoWidth: number;
  videoHeight: number;
  /** Preview container dimensions */
  containerWidth: number;
  containerHeight: number;
  /** Scale factor for webcam size (default 1/8 = 0.125) */
  webcamScale?: number;
  /** Margin from edges in pixels (before container scaling) */
  margin?: number;
  /** Corner radius as percentage of webcam width (default 0.08 = 8%) */
  cornerRadius?: number;
}

/**
 * Calculate the scale factor to fit video in container while maintaining aspect ratio
 */
function calculateVideoScale(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
): { scale: number; offsetX: number; offsetY: number } {
  if (videoWidth === 0 || videoHeight === 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }

  const scaleX = containerWidth / videoWidth;
  const scaleY = containerHeight / videoHeight;
  const scale = Math.min(scaleX, scaleY);

  // Center the video in the container
  const scaledWidth = videoWidth * scale;
  const scaledHeight = videoHeight * scale;
  const offsetX = (containerWidth - scaledWidth) / 2;
  const offsetY = (containerHeight - scaledHeight) / 2;

  return { scale, offsetX, offsetY };
}

export function WebcamOverlay({
  webcamSrc,
  currentTimeMs,
  isPlaying,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight,
  webcamScale = 0.125, // 1/8 of screen width
  margin = 20,
  cornerRadius = 0.08, // 8% of webcam width
}: WebcamOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [webcamDimensions, setWebcamDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Sync webcam playback with main video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const targetTime = currentTimeMs / 1000;
    const diff = Math.abs(video.currentTime - targetTime);

    // Only sync if difference is significant (> 100ms)
    if (diff > 0.1) {
      video.currentTime = targetTime;
    }
  }, [currentTimeMs]);

  // Handle play/pause sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {
        // Ignore play errors (e.g., user hasn't interacted yet)
      });
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Get webcam dimensions when loaded
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setWebcamDimensions({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    }
  };

  // Calculate positioning
  const { scale, offsetX, offsetY } = calculateVideoScale(
    videoWidth,
    videoHeight,
    containerWidth,
    containerHeight,
  );

  // Calculate webcam size (1/8 of the scaled video width)
  const scaledVideoWidth = videoWidth * scale;
  const scaledVideoHeight = videoHeight * scale;
  const webcamWidth = scaledVideoWidth * webcamScale;

  // Calculate webcam height maintaining aspect ratio
  const webcamAspectRatio = webcamDimensions
    ? webcamDimensions.width / webcamDimensions.height
    : 16 / 9; // Default to 16:9 until we know the actual ratio
  const webcamHeight = webcamWidth / webcamAspectRatio;

  // Position in bottom-right corner of the video (not container)
  // The video is centered in the container with offsets
  const scaledMargin = margin * scale;
  const webcamX = offsetX + scaledVideoWidth - webcamWidth - scaledMargin;
  const webcamY = offsetY + scaledVideoHeight - webcamHeight - scaledMargin;

  // Calculate border radius
  const borderRadius = webcamWidth * cornerRadius;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <video
        ref={videoRef}
        src={webcamSrc}
        muted
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        className="absolute object-cover"
        style={{
          left: webcamX,
          top: webcamY,
          width: webcamWidth,
          height: webcamHeight,
          borderRadius: borderRadius,
          // Add a subtle border for better visibility
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
        }}
      >
        <track kind="captions" />
      </video>
    </div>
  );
}

export default WebcamOverlay;

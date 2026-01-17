/**
 * ClickIndicator - Renders visual feedback for mouse clicks
 *
 * Shows a ripple effect at the click position that fades out over time.
 */

import { useMemo } from "react";
import type { MouseClickEvent } from "../../types/recording";

interface ClickWithAge extends MouseClickEvent {
  age: number; // How many ms ago the click occurred
}

interface ClickIndicatorProps {
  /** Recent clicks with age information */
  clicks: ClickWithAge[];
  /** Video dimensions for coordinate scaling */
  videoWidth: number;
  videoHeight: number;
  /** Preview container dimensions */
  containerWidth: number;
  containerHeight: number;
  /** Duration in ms for click to fade out (default 500) */
  fadeDuration?: number;
}

/**
 * Calculate the scale factor to fit video in container while maintaining aspect ratio
 */
function calculateScale(
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

export function ClickIndicator({
  clicks,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight,
  fadeDuration = 500,
}: ClickIndicatorProps) {
  const { scale, offsetX, offsetY } = useMemo(
    () =>
      calculateScale(videoWidth, videoHeight, containerWidth, containerHeight),
    [videoWidth, videoHeight, containerWidth, containerHeight],
  );

  if (clicks.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {clicks.map((click, index) => {
        // Convert video coordinates to container coordinates
        const x = click.x * scale + offsetX;
        const y = click.y * scale + offsetY;

        // Calculate opacity based on age (fade out)
        const progress = Math.min(click.age / fadeDuration, 1);
        const opacity = 1 - progress;

        // Calculate ripple size (grows as it fades)
        const baseSize = 20;
        const maxSize = 60;
        const size = baseSize + (maxSize - baseSize) * progress;

        // Color based on button type
        const color =
          click.button === "left"
            ? "rgba(59, 130, 246, " // Blue
            : click.button === "right"
              ? "rgba(239, 68, 68, " // Red
              : "rgba(168, 85, 247, "; // Purple for middle

        return (
          <div
            key={`${click.processTimeMs}-${index}`}
            className="absolute rounded-full"
            style={{
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              backgroundColor: color + opacity * 0.3 + ")",
              border: `2px solid ${color + opacity + ")"}`,
              transform: "translate(0, 0)",
            }}
          />
        );
      })}
    </div>
  );
}

export default ClickIndicator;

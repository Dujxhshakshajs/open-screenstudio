import type { Layout, LayoutType } from "../types/project";

/**
 * Find the active layout at a given output time
 */
export function findLayoutAtTime(
  layouts: Layout[],
  outputTimeMs: number,
): Layout | null {
  for (const layout of layouts) {
    if (outputTimeMs >= layout.startTime && outputTimeMs < layout.endTime) {
      return layout;
    }
  }
  return null;
}

/**
 * Position and size for camera overlay
 */
export interface CameraRect {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

/**
 * Position and size for screen content
 */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

/**
 * Combined layout rendering info
 */
export interface LayoutRenderInfo {
  camera: CameraRect;
  screen: ScreenRect;
  layoutType: LayoutType;
}

/**
 * Default camera aspect ratio (16:9)
 */
const CAMERA_ASPECT_RATIO = 16 / 9;

/**
 * Calculate camera and screen positions for a given layout
 */
export function calculateLayoutPositions(
  layout: Layout | null,
  containerWidth: number,
  containerHeight: number,
): LayoutRenderInfo {
  // Default: screen-with-camera layout
  if (!layout) {
    return calculateScreenWithCamera(
      containerWidth,
      containerHeight,
      0.2, // default size
      { x: 0.9, y: 0.9 }, // bottom-right
    );
  }

  switch (layout.type) {
    case "screen-only":
      return {
        screen: {
          x: 0,
          y: 0,
          width: containerWidth,
          height: containerHeight,
          visible: true,
        },
        camera: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          visible: false,
        },
        layoutType: "screen-only",
      };

    case "camera-only":
      return {
        screen: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          visible: false,
        },
        camera: {
          x: 0,
          y: 0,
          width: containerWidth,
          height: containerHeight,
          visible: true,
        },
        layoutType: "camera-only",
      };

    case "side-by-side":
      return calculateSideBySide(containerWidth, containerHeight);

    case "screen-with-camera":
    default:
      return calculateScreenWithCamera(
        containerWidth,
        containerHeight,
        layout.cameraSize,
        layout.cameraPosition,
      );
  }
}

/**
 * Calculate screen-with-camera layout (PiP)
 */
function calculateScreenWithCamera(
  containerWidth: number,
  containerHeight: number,
  cameraSize: number,
  cameraPosition: { x: number; y: number },
): LayoutRenderInfo {
  // Camera size is a fraction of container width
  const cameraWidth = containerWidth * cameraSize;
  const cameraHeight = cameraWidth / CAMERA_ASPECT_RATIO;

  // Camera position is normalized (0-1), where position indicates center
  const padding = 16; // Padding from edges

  // Calculate camera position with padding constraints
  let cameraX = cameraPosition.x * containerWidth - cameraWidth / 2;
  let cameraY = cameraPosition.y * containerHeight - cameraHeight / 2;

  // Clamp to container bounds with padding
  cameraX = Math.max(
    padding,
    Math.min(containerWidth - cameraWidth - padding, cameraX),
  );
  cameraY = Math.max(
    padding,
    Math.min(containerHeight - cameraHeight - padding, cameraY),
  );

  return {
    screen: {
      x: 0,
      y: 0,
      width: containerWidth,
      height: containerHeight,
      visible: true,
    },
    camera: {
      x: cameraX,
      y: cameraY,
      width: cameraWidth,
      height: cameraHeight,
      visible: true,
    },
    layoutType: "screen-with-camera",
  };
}

/**
 * Calculate side-by-side layout
 */
function calculateSideBySide(
  containerWidth: number,
  containerHeight: number,
): LayoutRenderInfo {
  const halfWidth = containerWidth / 2;
  const gap = 8;

  return {
    screen: {
      x: 0,
      y: 0,
      width: halfWidth - gap / 2,
      height: containerHeight,
      visible: true,
    },
    camera: {
      x: halfWidth + gap / 2,
      y: 0,
      width: halfWidth - gap / 2,
      height: containerHeight,
      visible: true,
    },
    layoutType: "side-by-side",
  };
}

/**
 * Generate a unique layout ID
 */
export function generateLayoutId(): string {
  return `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a default layout covering the entire duration
 */
export function createDefaultLayout(
  durationMs: number,
  type: LayoutType = "screen-with-camera",
): Layout {
  return {
    id: generateLayoutId(),
    startTime: 0,
    endTime: durationMs,
    type,
    cameraSize: 0.2,
    cameraPosition: { x: 0.9, y: 0.9 },
  };
}

/**
 * Get display name for a layout type
 */
export function getLayoutTypeName(type: LayoutType): string {
  switch (type) {
    case "screen-only":
      return "Screen Only";
    case "camera-only":
      return "Camera Only";
    case "screen-with-camera":
      return "Screen + Camera";
    case "side-by-side":
      return "Side by Side";
    default:
      return "Unknown";
  }
}

/**
 * Get all available layout types
 */
export const LAYOUT_TYPES: LayoutType[] = [
  "screen-only",
  "camera-only",
  "screen-with-camera",
  "side-by-side",
];

/**
 * Timeline layout constants
 * Centralized configuration for consistent sizing across timeline components
 */

// Track dimensions
export const TIMELINE_TRACK_HEIGHT = 48;
export const TIMELINE_RULER_HEIGHT = 24;
export const TIMELINE_LABEL_WIDTH = 80; // w-20 = 5rem = 80px
export const TIMELINE_PADDING = 8;

// Slice dimensions
export const SLICE_MIN_WIDTH = 24;
export const SLICE_TRIM_HANDLE_WIDTH = 8;
export const SLICE_MIN_DURATION_MS = 100;

// Playhead dimensions
export const PLAYHEAD_WIDTH = 12;
export const PLAYHEAD_HEAD_SIZE = 12;

// Zoom configuration
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 1.5;
export const BASE_PX_PER_MS = 0.1; // 100px per second at zoom=1

// Time ruler configuration
export const RULER_TARGET_PX_PER_TICK = 80;
export const RULER_NICE_INTERVALS_MS = [
  1000, 2000, 5000, 10000, 15000, 30000, 60000,
];
export const RULER_MAJOR_TICK_MULTIPLIER = 5;

// Animation
export const SEEK_THRESHOLD_MS = 100; // Only seek if difference > this value

// Export types for edit-aware video export
// Matches the Rust types in src-tauri/src/export/types.rs

/**
 * A single segment to include in export (represents trim/cut edits)
 */
export interface ExportSegment {
  /** Start time in source media (milliseconds) */
  sourceStartMs: number;
  /** End time in source media (milliseconds) */
  sourceEndMs: number;
  /** Time scale factor (1.0 = normal, 2.0 = 2x speed, 0.5 = half speed) */
  timeScale: number;
}

/**
 * Edit instructions for a track (screen or camera)
 */
export interface TrackEdits {
  /** Ordered list of segments to include */
  segments: ExportSegment[];
}

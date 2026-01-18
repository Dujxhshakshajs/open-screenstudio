/**
 * Waveform data returned from the Rust backend
 */
export interface WaveformData {
  /** Peaks normalized to 0.0-1.0 range */
  peaks: number[];
  /** Duration of the source audio in milliseconds */
  durationMs: number;
  /** Samples per second (peaks.length / duration in seconds) */
  samplesPerSecond: number;
}

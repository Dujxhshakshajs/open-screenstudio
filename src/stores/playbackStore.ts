import { create } from "zustand";

interface PlaybackState {
  // Time state
  currentTimeMs: number; // "Output" time (after all edits applied)
  isPlaying: boolean;
  playbackRate: number;

  // Duration
  totalDurationMs: number; // Total output duration (sum of all slices)

  // Actions
  setCurrentTime: (timeMs: number) => void;
  setTotalDuration: (durationMs: number) => void;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  setPlaybackRate: (rate: number) => void;
  stepFrame: (direction: "forward" | "back", fps: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  // Initial state
  currentTimeMs: 0,
  isPlaying: false,
  playbackRate: 1,
  totalDurationMs: 0,

  // Set current time (clamped to valid range)
  setCurrentTime: (timeMs: number) => {
    const { totalDurationMs } = get();
    const clampedTime = Math.max(0, Math.min(timeMs, totalDurationMs));
    set({ currentTimeMs: clampedTime });
  },

  // Set total duration
  setTotalDuration: (durationMs: number) => {
    set({ totalDurationMs: durationMs });
  },

  // Play
  play: () => {
    set({ isPlaying: true });
  },

  // Pause
  pause: () => {
    set({ isPlaying: false });
  },

  // Toggle play/pause
  togglePlayPause: () => {
    const { isPlaying } = get();
    set({ isPlaying: !isPlaying });
  },

  // Set playback rate
  setPlaybackRate: (rate: number) => {
    set({ playbackRate: rate });
  },

  // Step forward or back by one frame
  stepFrame: (direction: "forward" | "back", fps: number) => {
    const { currentTimeMs, totalDurationMs } = get();
    const frameDurationMs = 1000 / fps;
    const delta = direction === "forward" ? frameDurationMs : -frameDurationMs;
    const newTime = Math.max(
      0,
      Math.min(currentTimeMs + delta, totalDurationMs),
    );
    set({ currentTimeMs: newTime });
  },
}));

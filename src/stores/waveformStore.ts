import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { WaveformData } from "../types/waveform";

interface WaveformState {
  /** Cached waveform data by audio path */
  cache: Record<string, WaveformData>;
  /** Loading state by audio path */
  loading: Record<string, boolean>;
  /** Error messages by audio path */
  errors: Record<string, string | null>;

  // Actions
  fetchWaveform: (audioPath: string) => Promise<WaveformData | null>;
  clearCache: () => void;
}

export const useWaveformStore = create<WaveformState>((set, get) => ({
  cache: {},
  loading: {},
  errors: {},

  fetchWaveform: async (audioPath: string) => {
    const { cache, loading } = get();

    // Return cached data if available
    if (cache[audioPath]) {
      return cache[audioPath];
    }

    // Don't duplicate requests
    if (loading[audioPath]) {
      return null;
    }

    set((state) => ({
      loading: { ...state.loading, [audioPath]: true },
      errors: { ...state.errors, [audioPath]: null },
    }));

    try {
      const waveformData = await invoke<WaveformData>("get_waveform", {
        audioPath,
        samplesPerSecond: 50, // 50 peaks per second for smooth visualization
      });

      set((state) => ({
        cache: { ...state.cache, [audioPath]: waveformData },
        loading: { ...state.loading, [audioPath]: false },
      }));

      return waveformData;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to fetch waveform for ${audioPath}:`, errorMsg);

      set((state) => ({
        loading: { ...state.loading, [audioPath]: false },
        errors: { ...state.errors, [audioPath]: errorMsg },
      }));

      return null;
    }
  },

  clearCache: () => set({ cache: {}, loading: {}, errors: {} }),
}));

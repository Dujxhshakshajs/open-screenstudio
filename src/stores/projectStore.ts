import { create } from "zustand";
import type {
  Project,
  ProjectMeta,
  ProjectConfig,
  RecordingMetadata,
  Marker,
  Slice,
  Layout,
  Scene,
} from "../types/project";
import {
  generateSliceId,
  createDefaultSlice,
  calculateSliceOutputStart,
} from "../utils/sliceUtils";

// Default project configuration
const defaultConfig: ProjectConfig = {
  background: {
    type: "gradient",
    gradient: {
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
      stops: [
        { color: "#3F37C9", at: 0 },
        { color: "#8C87DF", at: 1 },
      ],
    },
  },
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  shadow: {
    intensity: 0.75,
    angle: 90,
    distance: 25,
    blur: 20,
  },
  cursor: {
    size: 1.5,
    smoothing: {
      enabled: true,
      spring: { stiffness: 470, damping: 70, mass: 3 },
    },
    hideAfterMs: null,
  },
  camera: {
    enabled: true,
    position: "bottom-right",
    size: 0.35,
    roundness: 0.25,
    mirror: false,
  },
  audio: {
    systemVolume: 1,
    microphoneVolume: 1,
    enhanceMicrophone: true,
  },
  recordingRange: [0, 0],
  outputAspectRatio: { x: 16, y: 9 },
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateLayoutId(): string {
  return `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface ProjectState {
  // Project data
  project: Project | null;
  meta: ProjectMeta | null;
  markers: Marker[];
  recordingMetadata: RecordingMetadata | null;

  // Project path (where it's saved)
  projectPath: string | null;

  // Active scene index
  activeSceneIndex: number;

  // Dirty state
  isDirty: boolean;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Basic project actions
  createProject: () => void;
  openProject: () => void;
  saveProject: () => Promise<void>;
  closeProject: () => void;
  setProject: (project: Project) => void;
  updateConfig: (config: Partial<ProjectConfig>) => void;
  setDirty: (dirty: boolean) => void;

  // Scene actions
  setActiveScene: (index: number) => void;
  initializeFromRecording: (durationMs: number) => void;

  // Slice actions
  addSlice: (sceneIndex: number, slice: Slice) => void;
  updateSlice: (
    sceneIndex: number,
    sliceId: string,
    updates: Partial<Slice>,
  ) => void;
  removeSlice: (sceneIndex: number, sliceId: string) => void;
  splitSlice: (
    sceneIndex: number,
    sliceId: string,
    splitOutputTimeMs: number,
  ) => void;
  reorderSlices: (
    sceneIndex: number,
    fromIndex: number,
    toIndex: number,
  ) => void;

  // Layout actions
  addLayout: (sceneIndex: number, layout: Layout) => void;
  updateLayout: (
    sceneIndex: number,
    layoutId: string,
    updates: Partial<Layout>,
  ) => void;
  removeLayout: (sceneIndex: number, layoutId: string) => void;

  // Helpers
  getActiveScene: () => Scene | null;
  getSlices: () => Slice[];
  getLayouts: () => Layout[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  project: null,
  meta: null,
  markers: [],
  recordingMetadata: null,
  projectPath: null,
  activeSceneIndex: 0,
  isDirty: false,
  isLoading: false,
  error: null,

  // Create a new project
  createProject: () => {
    const now = new Date().toISOString();
    const project: Project = {
      id: generateId(),
      name: "Untitled Recording",
      createdAt: now,
      config: { ...defaultConfig },
      scenes: [],
    };

    const meta: ProjectMeta = {
      version: "0.1.0",
      format: "osp-v1",
      createdAt: now,
      updatedAt: now,
    };

    set({
      project,
      meta,
      markers: [],
      recordingMetadata: null,
      projectPath: null,
      activeSceneIndex: 0,
      isDirty: true,
      error: null,
    });
  },

  // Open an existing project
  openProject: async () => {
    // TODO: Implement with Tauri file dialog
    console.log("Open project - will be implemented with Tauri");
  },

  // Save the current project
  saveProject: async () => {
    const { project, meta, markers, projectPath } = get();

    if (!project || !meta) {
      set({ error: "No project to save" });
      return;
    }

    // TODO: Implement with Tauri commands
    console.log("Save project - will be implemented with Tauri", {
      project,
      meta,
      markers,
      projectPath,
    });

    // Update meta timestamp
    const updatedMeta = { ...meta, updatedAt: new Date().toISOString() };
    set({ meta: updatedMeta, isDirty: false });
  },

  // Close the current project
  closeProject: () => {
    set({
      project: null,
      meta: null,
      markers: [],
      recordingMetadata: null,
      projectPath: null,
      activeSceneIndex: 0,
      isDirty: false,
      error: null,
    });
  },

  // Set the entire project
  setProject: (project: Project) => {
    set({ project, isDirty: true });
  },

  // Update project config
  updateConfig: (configUpdate: Partial<ProjectConfig>) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        config: { ...project.config, ...configUpdate },
      },
      isDirty: true,
    });
  },

  // Set dirty state
  setDirty: (dirty: boolean) => {
    set({ isDirty: dirty });
  },

  // Set active scene index
  setActiveScene: (index: number) => {
    const { project } = get();
    if (!project || index < 0 || index >= project.scenes.length) return;
    set({ activeSceneIndex: index });
  },

  // Initialize project with a default scene from recording duration
  initializeFromRecording: (durationMs: number) => {
    const { project } = get();
    if (!project) return;

    // Create a default scene with one slice covering the entire recording
    const defaultScene: Scene = {
      id: generateId(),
      name: "Main",
      type: "recording",
      sessionIndex: 0,
      slices: [createDefaultSlice(durationMs)],
      zoomRanges: [],
      layouts: [
        {
          id: generateLayoutId(),
          startTime: 0,
          endTime: durationMs,
          type: "screen-with-camera",
          cameraSize: 0.2,
          cameraPosition: { x: 0.9, y: 0.9 },
        },
      ],
    };

    set({
      project: {
        ...project,
        scenes: [defaultScene],
        config: {
          ...project.config,
          recordingRange: [0, durationMs],
        },
      },
      activeSceneIndex: 0,
      isDirty: true,
    });
  },

  // Add a slice to a scene
  addSlice: (sceneIndex: number, slice: Slice) => {
    const { project } = get();
    if (!project || sceneIndex < 0 || sceneIndex >= project.scenes.length)
      return;

    const newScenes = [...project.scenes];
    newScenes[sceneIndex] = {
      ...newScenes[sceneIndex],
      slices: [...newScenes[sceneIndex].slices, slice],
    };

    set({
      project: { ...project, scenes: newScenes },
      isDirty: true,
    });
  },

  // Update a slice in a scene
  updateSlice: (
    sceneIndex: number,
    sliceId: string,
    updates: Partial<Slice>,
  ) => {
    const { project } = get();
    if (!project || sceneIndex < 0 || sceneIndex >= project.scenes.length)
      return;

    const scene = project.scenes[sceneIndex];
    const sliceIndex = scene.slices.findIndex((s) => s.id === sliceId);
    if (sliceIndex === -1) return;

    const newSlices = [...scene.slices];
    newSlices[sliceIndex] = { ...newSlices[sliceIndex], ...updates };

    const newScenes = [...project.scenes];
    newScenes[sceneIndex] = { ...scene, slices: newSlices };

    set({
      project: { ...project, scenes: newScenes },
      isDirty: true,
    });
  },

  // Remove a slice from a scene
  removeSlice: (sceneIndex: number, sliceId: string) => {
    const { project } = get();
    if (!project || sceneIndex < 0 || sceneIndex >= project.scenes.length)
      return;

    const scene = project.scenes[sceneIndex];
    const newSlices = scene.slices.filter((s) => s.id !== sliceId);

    // Don't allow removing the last slice
    if (newSlices.length === 0) return;

    const newScenes = [...project.scenes];
    newScenes[sceneIndex] = { ...scene, slices: newSlices };

    set({
      project: { ...project, scenes: newScenes },
      isDirty: true,
    });
  },

  // Split a slice at a given output time
  splitSlice: (
    sceneIndex: number,
    sliceId: string,
    splitOutputTimeMs: number,
  ) => {
    const { project } = get();
    if (!project || sceneIndex < 0 || sceneIndex >= project.scenes.length)
      return;

    const scene = project.scenes[sceneIndex];
    const sliceIndex = scene.slices.findIndex((s) => s.id === sliceId);
    if (sliceIndex === -1) return;

    const slice = scene.slices[sliceIndex];

    // Calculate the output start of this slice
    const sliceOutputStart = calculateSliceOutputStart(
      scene.slices,
      sliceIndex,
    );

    // Calculate the offset within the slice (in output time)
    const offsetInSlice = splitOutputTimeMs - sliceOutputStart;

    // Convert to source time
    const sourceTimeAtSplit =
      slice.sourceStartMs + offsetInSlice * slice.timeScale;

    // Validate the split point is within the slice
    const minSplitDuration = 100; // Minimum 100ms per resulting slice
    if (
      sourceTimeAtSplit <= slice.sourceStartMs + minSplitDuration ||
      sourceTimeAtSplit >= slice.sourceEndMs - minSplitDuration
    ) {
      return; // Split point too close to edges
    }

    // Create two new slices
    const slice1: Slice = {
      ...slice,
      id: generateSliceId(),
      sourceEndMs: sourceTimeAtSplit,
    };

    const slice2: Slice = {
      ...slice,
      id: generateSliceId(),
      sourceStartMs: sourceTimeAtSplit,
    };

    // Replace original with two new slices
    const newSlices = [...scene.slices];
    newSlices.splice(sliceIndex, 1, slice1, slice2);

    const newScenes = [...project.scenes];
    newScenes[sceneIndex] = { ...scene, slices: newSlices };

    set({
      project: { ...project, scenes: newScenes },
      isDirty: true,
    });
  },

  // Reorder slices within a scene
  reorderSlices: (sceneIndex: number, fromIndex: number, toIndex: number) => {
    const { project } = get();
    if (!project || sceneIndex < 0 || sceneIndex >= project.scenes.length)
      return;

    const scene = project.scenes[sceneIndex];
    if (
      fromIndex < 0 ||
      fromIndex >= scene.slices.length ||
      toIndex < 0 ||
      toIndex >= scene.slices.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const newSlices = [...scene.slices];
    const [removed] = newSlices.splice(fromIndex, 1);
    newSlices.splice(toIndex, 0, removed);

    const newScenes = [...project.scenes];
    newScenes[sceneIndex] = { ...scene, slices: newSlices };

    set({
      project: { ...project, scenes: newScenes },
      isDirty: true,
    });
  },

  // Add a layout to a scene
  addLayout: (sceneIndex: number, layout: Layout) => {
    const { project } = get();
    if (!project || sceneIndex < 0 || sceneIndex >= project.scenes.length)
      return;

    const newScenes = [...project.scenes];
    newScenes[sceneIndex] = {
      ...newScenes[sceneIndex],
      layouts: [...newScenes[sceneIndex].layouts, layout],
    };

    set({
      project: { ...project, scenes: newScenes },
      isDirty: true,
    });
  },

  // Update a layout in a scene
  updateLayout: (
    sceneIndex: number,
    layoutId: string,
    updates: Partial<Layout>,
  ) => {
    const { project } = get();
    if (!project || sceneIndex < 0 || sceneIndex >= project.scenes.length)
      return;

    const scene = project.scenes[sceneIndex];
    const layoutIndex = scene.layouts.findIndex((l) => l.id === layoutId);
    if (layoutIndex === -1) return;

    const newLayouts = [...scene.layouts];
    newLayouts[layoutIndex] = { ...newLayouts[layoutIndex], ...updates };

    const newScenes = [...project.scenes];
    newScenes[sceneIndex] = { ...scene, layouts: newLayouts };

    set({
      project: { ...project, scenes: newScenes },
      isDirty: true,
    });
  },

  // Remove a layout from a scene
  removeLayout: (sceneIndex: number, layoutId: string) => {
    const { project } = get();
    if (!project || sceneIndex < 0 || sceneIndex >= project.scenes.length)
      return;

    const scene = project.scenes[sceneIndex];
    const newLayouts = scene.layouts.filter((l) => l.id !== layoutId);

    const newScenes = [...project.scenes];
    newScenes[sceneIndex] = { ...scene, layouts: newLayouts };

    set({
      project: { ...project, scenes: newScenes },
      isDirty: true,
    });
  },

  // Get the currently active scene
  getActiveScene: () => {
    const { project, activeSceneIndex } = get();
    if (
      !project ||
      activeSceneIndex < 0 ||
      activeSceneIndex >= project.scenes.length
    ) {
      return null;
    }
    return project.scenes[activeSceneIndex];
  },

  // Get slices from the active scene
  getSlices: () => {
    const scene = get().getActiveScene();
    return scene?.slices ?? [];
  },

  // Get layouts from the active scene
  getLayouts: () => {
    const scene = get().getActiveScene();
    return scene?.layouts ?? [];
  },
}));

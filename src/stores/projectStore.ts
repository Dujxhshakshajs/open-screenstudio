import { create } from "zustand";
import type {
  Project,
  ProjectMeta,
  ProjectConfig,
  RecordingMetadata,
  Marker,
} from "../types/project";

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

interface ProjectState {
  // Project data
  project: Project | null;
  meta: ProjectMeta | null;
  markers: Marker[];
  recordingMetadata: RecordingMetadata | null;

  // Project path (where it's saved)
  projectPath: string | null;

  // Dirty state
  isDirty: boolean;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  createProject: () => void;
  openProject: () => void;
  saveProject: () => Promise<void>;
  closeProject: () => void;
  setProject: (project: Project) => void;
  updateConfig: (config: Partial<ProjectConfig>) => void;
  setDirty: (dirty: boolean) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  project: null,
  meta: null,
  markers: [],
  recordingMetadata: null,
  projectPath: null,
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
      isDirty: true,
      error: null,
    });
  },

  // Open an existing project
  openProject: async () => {
    // TODO: Implement with Tauri file dialog
    // For now, just log
    console.log("Open project - will be implemented with Tauri");

    // Placeholder: This will be implemented with Tauri commands
    // const { open } = await import("@tauri-apps/plugin-dialog");
    // const selected = await open({
    //   directory: true,
    //   filters: [{ name: "Open ScreenStudio Project", extensions: ["osp"] }],
    // });
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
}));

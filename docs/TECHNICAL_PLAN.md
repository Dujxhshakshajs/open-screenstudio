# Technical Plan

This document outlines the technical architecture, stack decisions, and implementation plan for Open ScreenStudio.

> **Status:** Draft - Open for discussion
> 
> We want your input! Comment on this plan in the GitHub Discussions or open issues for specific concerns.

---

## Table of Contents

- [Stack Decision](#stack-decision)
- [Architecture Overview](#architecture-overview)
- [Technology Choices](#technology-choices)
- [Project Structure](#project-structure)
- [Platform APIs](#platform-apis)
- [Key Dependencies](#key-dependencies)
- [Implementation Phases](#implementation-phases)
- [Open Questions](#open-questions)
- [Getting Started (Development)](#getting-started-development)

---

## Stack Decision

After evaluating multiple approaches, we've chosen **Tauri + Rust** for the backend and **React + TypeScript** for the frontend.

### Why Tauri?

| Factor | Tauri | Electron | Native |
|--------|-------|----------|--------|
| **Bundle size** | ~10-15 MB | ~150 MB | ~5-10 MB |
| **Memory usage** | Low (system webview) | High (bundled Chromium) | Lowest |
| **Performance** | Excellent | Good | Best |
| **Cross-platform** | Yes | Yes | Separate codebases |
| **Native API access** | Excellent (Rust) | Limited (Node.js) | Full |
| **Contributor accessibility** | Medium | High | Low |
| **Security** | Excellent | Good | Varies |

### Why Not Electron?

Electron is a valid choice with a huge ecosystem, but for a screen recording app:

1. **Performance matters** - Recording + encoding is CPU intensive
2. **Memory matters** - We're already capturing video, can't afford Chromium overhead
3. **Native APIs** - Screen capture requires deep OS integration that Rust handles better
4. **Bundle size** - Users expect small, focused apps

### Why Not Fully Native?

1. **Maintenance burden** - Two completely separate codebases (Swift + C++)
2. **Contributor pool** - Fewer developers know both Swift and C++
3. **UI consistency** - Harder to maintain identical UX across platforms

### The Tradeoff

Tauri/Rust has a steeper learning curve than JavaScript, which may reduce the contributor pool. However:

- The frontend is still React/TypeScript (familiar to most web devs)
- Rust's safety guarantees reduce bugs in critical video processing code
- The architecture isolates platform-specific code, making contributions focused

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OPEN SCREENSTUDIO                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                   FRONTEND (React + TypeScript)              │   │
│   │                                                              │   │
│   │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │   │
│   │   │  Recording   │ │    Editor    │ │    Export    │        │   │
│   │   │    View      │ │     View     │ │     View     │        │   │
│   │   └──────────────┘ └──────────────┘ └──────────────┘        │   │
│   │                                                              │   │
│   │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │   │
│   │   │   Timeline   │ │   Preview    │ │   Settings   │        │   │
│   │   │  Component   │ │   Player     │ │    Panel     │        │   │
│   │   └──────────────┘ └──────────────┘ └──────────────┘        │   │
│   │                                                              │   │
│   │   State: Zustand    │    Styling: Tailwind CSS              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                   │                                 │
│                            Tauri IPC (Commands + Events)            │
│                                   │                                 │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      BACKEND (Rust + Tauri)                  │   │
│   │                                                              │   │
│   │   ┌─────────────────────────────────────────────────────┐   │   │
│   │   │                   Core Modules                       │   │   │
│   │   │                                                      │   │   │
│   │   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │   │
│   │   │  │ Screen  │ │  Audio  │ │ Cursor  │ │  Zoom   │   │   │   │
│   │   │  │ Capture │ │ Capture │ │ Tracker │ │ Engine  │   │   │   │
│   │   │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │   │
│   │   │                                                      │   │   │
│   │   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │   │
│   │   │  │ Project │ │ Export  │ │ Effects │ │ Preview │   │   │   │
│   │   │  │ Manager │ │ Engine  │ │ Pipeline│ │ Renderer│   │   │   │
│   │   │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │   │
│   │   │                                                      │   │   │
│   │   └─────────────────────────────────────────────────────┘   │   │
│   │                              │                               │   │
│   │   ┌─────────────────────────────────────────────────────┐   │   │
│   │   │              Platform Abstraction Layer              │   │   │
│   │   │                                                      │   │   │
│   │   │   Traits: ScreenCapture, AudioCapture, SystemInfo   │   │   │
│   │   └─────────────────────────────────────────────────────┘   │   │
│   │                              │                               │   │
│   └──────────────────────────────┼───────────────────────────────┘   │
│                                  │                                   │
│   ┌──────────────────────────────┴───────────────────────────────┐   │
│   │                     Platform Implementations                  │   │
│   │                                                               │   │
│   │   ┌─────────────────────┐     ┌─────────────────────┐        │   │
│   │   │       macOS         │     │       Windows       │        │   │
│   │   │                     │     │                     │        │   │
│   │   │  ScreenCaptureKit   │     │  Windows.Graphics   │        │   │
│   │   │  AVFoundation       │     │  .Capture           │        │   │
│   │   │  CoreAudio          │     │  WASAPI             │        │   │
│   │   │  CoreGraphics       │     │  Win32 API          │        │   │
│   │   └─────────────────────┘     └─────────────────────┘        │   │
│   │                                                               │   │
│   └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Recording Flow:
──────────────
Screen ──► Frame Buffer ──► Cursor Overlay ──► Memory/Disk
Audio  ──► Audio Buffer ──────────────────────► Memory/Disk
Cursor ──► Position Log ──────────────────────► Metadata

Export Flow:
────────────
Project ──► Effect Pipeline ──► Zoom/Smooth ──► Compositor ──► Encoder ──► File
                                                     ▲
                                              Background/Style
```

---

## Technology Choices

### Backend (Rust)

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | Tauri 2.0 | App framework, IPC, windowing |
| **Async Runtime** | Tokio | Async I/O, timers |
| **Video Encoding** | FFmpeg (ffmpeg-next) | Encode to MP4, GIF |
| **Serialization** | Serde | JSON for IPC and project files |
| **Error Handling** | thiserror, anyhow | Ergonomic error types |

### Frontend (TypeScript)

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | React 18 | UI components |
| **Language** | TypeScript | Type safety |
| **Build Tool** | Vite | Fast HMR, optimized builds |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **State** | Zustand | Lightweight state management |
| **Icons** | Lucide React | Consistent iconography |

### Platform Requirements

| Platform | Minimum Version | Reason |
|----------|-----------------|--------|
| **macOS** | 13.0 (Ventura) | ScreenCaptureKit improvements, modern Swift concurrency |
| **Windows** | 11 | Windows.Graphics.Capture stability, modern UI |

---

## Project Structure

```
open-screenstudio/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 # Lint, test, build
│   │   ├── release.yml            # Build and publish releases
│   │   └── pr-check.yml           # PR validation
│   └── ISSUE_TEMPLATE/
│
├── docs/
│   ├── VISION.md
│   ├── FEATURES.md
│   ├── ROADMAP.md
│   ├── TECHNICAL_PLAN.md          # This file
│   └── ARCHITECTURE.md            # Detailed architecture docs
│
├── src/                           # React frontend
│   ├── components/
│   │   ├── ui/                    # Generic UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Slider.tsx
│   │   │   └── ...
│   │   ├── recording/             # Recording-specific components
│   │   │   ├── SourcePicker.tsx
│   │   │   ├── RecordingControls.tsx
│   │   │   └── AudioMeter.tsx
│   │   ├── editor/                # Editor components
│   │   │   ├── Timeline.tsx
│   │   │   ├── Preview.tsx
│   │   │   ├── PropertiesPanel.tsx
│   │   │   └── ZoomRegion.tsx
│   │   └── export/                # Export components
│   │       ├── ExportDialog.tsx
│   │       ├── FormatPicker.tsx
│   │       └── ProgressBar.tsx
│   │
│   ├── hooks/
│   │   ├── useRecording.ts        # Recording state and controls
│   │   ├── useProject.ts          # Project management
│   │   ├── useExport.ts           # Export operations
│   │   └── useTauri.ts            # Tauri IPC helpers
│   │
│   ├── stores/
│   │   ├── recordingStore.ts      # Recording state
│   │   ├── projectStore.ts        # Current project state
│   │   ├── settingsStore.ts       # User preferences
│   │   └── uiStore.ts             # UI state (panels, dialogs)
│   │
│   ├── lib/
│   │   ├── tauri.ts               # Tauri command wrappers
│   │   ├── utils.ts               # Utility functions
│   │   └── constants.ts           # App constants
│   │
│   ├── types/
│   │   ├── recording.ts           # Recording types
│   │   ├── project.ts             # Project file types
│   │   └── events.ts              # Tauri event types
│   │
│   ├── App.tsx                    # Main app component
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Global styles + Tailwind
│
├── src-tauri/                     # Rust backend
│   ├── src/
│   │   ├── main.rs                # Tauri entry point
│   │   ├── lib.rs                 # Library exports
│   │   │
│   │   ├── commands/              # Tauri commands (IPC handlers)
│   │   │   ├── mod.rs
│   │   │   ├── recording.rs       # Start/stop/pause recording
│   │   │   ├── project.rs         # Save/load projects
│   │   │   ├── export.rs          # Export operations
│   │   │   └── system.rs          # System info, permissions
│   │   │
│   │   ├── capture/               # Screen and audio capture
│   │   │   ├── mod.rs
│   │   │   ├── traits.rs          # Platform-agnostic traits
│   │   │   ├── screen.rs          # Screen capture orchestration
│   │   │   ├── audio.rs           # Audio capture orchestration
│   │   │   ├── macos/             # macOS implementations
│   │   │   │   ├── mod.rs
│   │   │   │   ├── screen.rs      # ScreenCaptureKit
│   │   │   │   └── audio.rs       # CoreAudio
│   │   │   └── windows/           # Windows implementations
│   │   │       ├── mod.rs
│   │   │       ├── screen.rs      # Windows.Graphics.Capture
│   │   │       └── audio.rs       # WASAPI
│   │   │
│   │   ├── processing/            # Video/audio processing
│   │   │   ├── mod.rs
│   │   │   ├── cursor.rs          # Cursor tracking and smoothing
│   │   │   ├── zoom.rs            # Automatic zoom algorithm
│   │   │   ├── effects.rs         # Visual effects (blur, shadow)
│   │   │   └── compositor.rs      # Combine layers (screen, webcam, bg)
│   │   │
│   │   ├── export/                # Video encoding and export
│   │   │   ├── mod.rs
│   │   │   ├── encoder.rs         # FFmpeg encoding
│   │   │   ├── formats.rs         # MP4, GIF, WebM configs
│   │   │   └── presets.rs         # Export presets (YouTube, Twitter)
│   │   │
│   │   ├── project/               # Project management
│   │   │   ├── mod.rs
│   │   │   ├── file.rs            # Project file format (.osp)
│   │   │   ├── timeline.rs        # Timeline data structures
│   │   │   └── assets.rs          # Asset management
│   │   │
│   │   └── utils/                 # Shared utilities
│   │       ├── mod.rs
│   │       ├── error.rs           # Error types
│   │       └── logging.rs         # Logging setup
│   │
│   ├── Cargo.toml                 # Rust dependencies
│   ├── tauri.conf.json            # Tauri configuration
│   ├── build.rs                   # Build script
│   └── icons/                     # App icons
│
├── package.json                   # Node dependencies
├── tsconfig.json                  # TypeScript config
├── tailwind.config.js             # Tailwind config
├── vite.config.ts                 # Vite config
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── LICENSE
```

---

## Platform APIs

### macOS (13.0+)

| Feature | API | Notes |
|---------|-----|-------|
| **Screen Capture** | ScreenCaptureKit | Primary API, requires permission |
| **Window List** | ScreenCaptureKit | SCShareableContent |
| **System Audio** | ScreenCaptureKit | SCStreamConfiguration |
| **Microphone** | AVFoundation | AVAudioEngine |
| **Cursor Position** | CoreGraphics | CGEvent |
| **Cursor Image** | CoreGraphics | CGDisplayCopyCurrentCursor (undocumented) |
| **Permissions** | AVFoundation | Request screen recording permission |

### Windows (11+)

| Feature | API | Notes |
|---------|-----|-------|
| **Screen Capture** | Windows.Graphics.Capture | GraphicsCaptureItem |
| **Window List** | Win32 | EnumWindows |
| **System Audio** | WASAPI | Loopback capture |
| **Microphone** | WASAPI | Standard capture |
| **Cursor Position** | Win32 | GetCursorPos |
| **Cursor Image** | Win32 | GetCursorInfo |
| **Permissions** | Windows Settings | Prompt user if needed |

---

## Key Dependencies

### Rust Crates

```toml
[dependencies]
# Tauri
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"

# Async
tokio = { version = "1", features = ["full"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Video/Audio Processing
ffmpeg-next = "7"           # FFmpeg bindings

# Image Processing
image = "0.25"

# Error Handling
thiserror = "1"
anyhow = "1"

# Logging
tracing = "0.1"
tracing-subscriber = "0.3"

# Platform: macOS
[target.'cfg(target_os = "macos")'.dependencies]
objc2 = "0.5"
block2 = "0.5"
screencapturekit = "0.3"    # If available, else raw bindings
core-foundation = "0.9"
core-graphics = "0.23"

# Platform: Windows
[target.'cfg(target_os = "windows")'.dependencies]
windows = { version = "0.58", features = [
    "Graphics_Capture",
    "Win32_System_WinRT",
    "Win32_UI_WindowsAndMessaging",
    "Media_Audio",
]}
```

### Node Packages

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "lucide-react": "^0.400.0",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0"
  }
}
```

---

## Implementation Phases

### Phase 0: Project Setup (Week 1)

**Goal:** Working Tauri app with basic UI

- [ ] Initialize Tauri 2.0 project
- [ ] Configure React + TypeScript + Vite
- [ ] Set up Tailwind CSS
- [ ] Create basic app layout (3 views: Record, Edit, Export)
- [ ] Set up GitHub Actions CI/CD
- [ ] Configure ESLint + Prettier
- [ ] Write initial documentation

**Deliverable:** App opens on macOS and Windows, shows placeholder UI

### Phase 1: Screen Capture POC (Weeks 2-3)

**Goal:** Capture screen and save as video

- [ ] Implement screen capture trait
- [ ] macOS: ScreenCaptureKit implementation
- [ ] Windows: Windows.Graphics.Capture implementation
- [ ] List available screens/windows
- [ ] Capture frames to buffer
- [ ] Basic FFmpeg encoding to MP4
- [ ] Simple UI: source picker, record button

**Deliverable:** Can record screen and save MP4 file

### Phase 2: Audio Capture (Week 4)

**Goal:** Add audio recording

- [ ] Implement audio capture trait
- [ ] macOS: CoreAudio/AVFoundation microphone
- [ ] macOS: ScreenCaptureKit system audio
- [ ] Windows: WASAPI microphone
- [ ] Windows: WASAPI loopback
- [ ] Audio/video synchronization
- [ ] Audio level meters in UI

**Deliverable:** Record screen with microphone and system audio

### Phase 3: Cursor Tracking (Week 5)

**Goal:** Track and record cursor data

- [ ] Capture cursor position during recording
- [ ] Capture click events
- [ ] Capture cursor image/type
- [ ] Store as metadata alongside video
- [ ] Visualize cursor trail in preview

**Deliverable:** Cursor data captured and stored with recording

### Phase 4: Automatic Zoom (Weeks 6-7)

**Goal:** Implement the signature feature

- [ ] Zoom detection algorithm (click-based triggers)
- [ ] Smooth zoom transitions (easing functions)
- [ ] Configurable zoom levels
- [ ] Preview zoom in editor
- [ ] Apply zoom during export

**Deliverable:** Automatic zoom working in exports

### Phase 5: Cursor Smoothing (Week 8)

**Goal:** Transform jerky cursor into smooth movement

- [ ] Cursor interpolation algorithm
- [ ] Configurable smoothing intensity
- [ ] Handle edge cases (teleporting cursor)
- [ ] Preview smoothing in editor

**Deliverable:** Smooth cursor movement in exports

### Phase 6: Basic Editor (Weeks 9-10)

**Goal:** Timeline-based editing

- [ ] Timeline component with thumbnails
- [ ] Playhead and seeking
- [ ] Trim start/end
- [ ] Cut and remove sections
- [ ] Undo/redo system

**Deliverable:** Basic non-destructive editing

### Phase 7: Styling System (Week 11)

**Goal:** Backgrounds and visual polish

- [ ] Background colors and gradients
- [ ] Padding/spacing controls
- [ ] Corner radius
- [ ] Drop shadow
- [ ] Real-time preview

**Deliverable:** Styled output with customizable appearance

### Phase 8: Export System (Week 12)

**Goal:** Production-ready export

- [ ] MP4 export with quality options
- [ ] GIF export with optimization
- [ ] Resolution and frame rate options
- [ ] Progress indication
- [ ] Hardware acceleration

**Deliverable:** Export polished videos in multiple formats

### Phase 9: Polish & MVP Release (Weeks 13-14)

**Goal:** Ship it!

- [ ] Bug fixes and edge cases
- [ ] Performance optimization
- [ ] UI polish and animations
- [ ] User documentation
- [ ] Release builds for macOS and Windows

**Deliverable:** MVP release v0.1.0

---

## Open Questions

These need community input before implementation:

### 1. Project File Format

**Options:**
- **A) Custom binary format** - Smaller, faster, but proprietary
- **B) JSON + assets folder** - Human-readable, easier to debug
- **C) SQLite database** - Queryable, but overkill?

**Recommendation:** JSON + assets folder for transparency

### 2. Recording Storage

**Options:**
- **A) Record to memory, save on stop** - Simplest, but limited by RAM
- **B) Record directly to disk** - Handles long recordings, more complex
- **C) Hybrid** - Memory buffer with disk spillover

**Recommendation:** Start with A, implement B for long recordings

### 3. Preview Rendering

**Options:**
- **A) Re-render on every change** - Always accurate, CPU intensive
- **B) Cache rendered segments** - Faster, complex cache invalidation
- **C) Lower quality preview** - Fast, quality mismatch with export

**Recommendation:** Start with C, optimize with B later

### 4. Webcam Recording

**Options:**
- **A) Record as separate track** - Flexible, larger files
- **B) Composite in real-time** - Simpler, less flexible post-recording

**Recommendation:** A for flexibility

---

## Getting Started (Development)

### Prerequisites

**All Platforms:**
- Node.js 20+
- Rust 1.75+
- Git

**macOS:**
- Xcode Command Line Tools
- macOS 13.0+ (Ventura)

**Windows:**
- Visual Studio 2022 Build Tools
- Windows 11 SDK
- WebView2 Runtime

### Setup

```bash
# Clone the repository
git clone https://github.com/crafter-station/open-screenstudio.git
cd open-screenstudio

# Install Node dependencies
npm install

# Install Rust dependencies (automatic via Cargo)
cd src-tauri && cargo fetch && cd ..

# Run in development mode
npm run tauri dev
```

### Development Commands

```bash
# Start development server with hot reload
npm run tauri dev

# Build for production
npm run tauri build

# Run frontend only (for UI development)
npm run dev

# Lint and format
npm run lint
npm run format

# Run tests
npm run test              # Frontend tests
cd src-tauri && cargo test # Backend tests
```

### First Contribution

1. Pick an issue labeled `good first issue`
2. Comment that you're working on it
3. Fork and create a feature branch
4. Make your changes
5. Submit a PR

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

---

## Feedback Welcome!

This technical plan is open for discussion. We want to hear from you:

- **Disagree with a decision?** Open an issue explaining your concerns
- **Have experience with these technologies?** Share your insights
- **See a potential problem?** Let us know before we hit it

The best time to influence architecture is now, before we write the code.

**Start a discussion:** [GitHub Discussions](https://github.com/crafter-station/open-screenstudio/discussions)

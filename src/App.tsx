import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import RecordingToolbar from "./components/recording/RecordingToolbar";
import EditorView from "./components/editor/EditorView";

type WindowType = "toolbar" | "editor" | "unknown";

function App() {
  const [windowType, setWindowType] = useState<WindowType>("unknown");

  // Detect which window we're in
  useEffect(() => {
    const detectWindow = async () => {
      try {
        // First check URL params (for editor window opened via command)
        const urlParams = new URLSearchParams(window.location.search);
        const windowParam = urlParams.get("window");

        if (windowParam === "editor") {
          setWindowType("editor");
          document.body.classList.add("editor-window");
          return;
        }

        // Then check via Tauri command
        const label = await invoke<string>("get_window_label");
        if (label === "toolbar") {
          setWindowType("toolbar");
          document.body.classList.add("toolbar-window");
        } else if (label === "editor") {
          setWindowType("editor");
          document.body.classList.add("editor-window");
        } else {
          // Default to toolbar for main window
          setWindowType("toolbar");
          document.body.classList.add("toolbar-window");
        }
      } catch (err) {
        console.error("Failed to detect window type:", err);
        // Default to toolbar if detection fails
        setWindowType("toolbar");
        document.body.classList.add("toolbar-window");
      }
    };

    detectWindow();
  }, []);

  // Show loading state while detecting window
  if (windowType === "unknown") {
    return null;
  }

  // Render the floating toolbar for toolbar window
  if (windowType === "toolbar") {
    return <RecordingToolbar />;
  }

  // Render the editor view for editor window
  return <EditorView />;
}

export default App;

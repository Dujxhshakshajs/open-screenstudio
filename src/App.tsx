import { useState } from "react";
import { Video, Edit3, Download, FolderOpen, Plus } from "lucide-react";
import RecordingView from "./components/recording/RecordingView";
import EditorView from "./components/editor/EditorView";
import ExportView from "./components/export/ExportView";
import { useProjectStore } from "./stores/projectStore";

type View = "recording" | "editor" | "export";

function App() {
  const [currentView, setCurrentView] = useState<View>("recording");
  const { project, createProject, openProject } = useProjectStore();

  const navItems = [
    { id: "recording" as const, label: "Record", icon: Video },
    { id: "editor" as const, label: "Edit", icon: Edit3 },
    { id: "export" as const, label: "Export", icon: Download },
  ];

  return (
    <div className="flex h-screen bg-background dark">
      {/* Sidebar */}
      <aside className="w-16 bg-muted/50 border-r border-border flex flex-col items-center py-4 gap-2">
        {/* Logo */}
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-4">
          <Video className="w-5 h-5 text-white" />
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Project Actions */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={createProject}
            className="w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            title="New Project"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px]">New</span>
          </button>
          <button
            type="button"
            onClick={openProject}
            className="w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            title="Open Project"
          >
            <FolderOpen className="w-5 h-5" />
            <span className="text-[10px]">Open</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 border-b border-border flex items-center px-4 gap-4">
          <h1 className="text-sm font-medium">
            {project ? project.name : "Open ScreenStudio"}
          </h1>
          {project && (
            <span className="text-xs text-muted-foreground">
              {currentView === "recording" && "Recording"}
              {currentView === "editor" && "Editing"}
              {currentView === "export" && "Export"}
            </span>
          )}
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-hidden">
          {currentView === "recording" && <RecordingView />}
          {currentView === "editor" && <EditorView />}
          {currentView === "export" && <ExportView />}
        </div>
      </main>
    </div>
  );
}

export default App;

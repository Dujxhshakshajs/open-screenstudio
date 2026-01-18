import type { ReactNode } from "react";

interface TimelineTrackProps {
  label: string;
  children: ReactNode;
  height?: number;
}

export default function TimelineTrack({
  label,
  children,
  height = 48,
}: TimelineTrackProps) {
  return (
    <div className="flex border-b border-[--border]">
      {/* Track label */}
      <div
        className="flex-shrink-0 w-20 bg-[--muted] border-r border-[--border] px-2 flex items-center"
        style={{ height }}
      >
        <span className="text-xs text-[--foreground]/70 truncate">{label}</span>
      </div>

      {/* Track content area */}
      <div className="relative flex-1 bg-[--background]" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

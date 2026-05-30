import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Megaphone, Link } from "lucide-react";
import { useStore } from "@/store/useStore";

interface AnnouncementPanelProps {
  eventId: string;
}

export default function AnnouncementPanel({ eventId }: AnnouncementPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const allAnnouncements = useStore((s) => s.announcements);
  const announcements = useMemo(
    () => allAnnouncements.filter((a) => a.eventId === eventId).sort((a, b) => a.version - b.version),
    [allAnnouncements, eventId]
  );

  return (
    <div className="bg-[#1a1f36] border border-[#2a3050] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#222845] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#e8a838]" />
          <span className="text-[#f0ece4] font-medium text-sm">信用事件公告</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#6b7894]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#6b7894]" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {announcements.length === 0 && (
            <p className="text-[#6b7894] text-xs">暂无公告</p>
          )}
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className={`rounded border ${
                ann.isCurrentVersion
                  ? "border-l-4 border-l-[#2dd4a8] border-[#2a3050]"
                  : "border-[#2a3050] opacity-60"
              } bg-[#0f1225] p-3 space-y-2`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                    ann.isCurrentVersion
                      ? "bg-[#2dd4a8]/20 text-[#2dd4a8]"
                      : "bg-[#2a3050] text-[#6b7894]"
                  }`}
                >
                  V{ann.version}
                </span>
                <span className="text-[#f0ece4] text-xs">{ann.sourceInstitution}</span>
                <span className="text-[#6b7894] text-xs">
                  {new Date(ann.publishedAt).toLocaleString("zh-CN")}
                </span>
                {!ann.isCurrentVersion && (
                  <span className="bg-[#2a3050] text-[#6b7894] text-xs px-1.5 py-0.5 rounded">
                    历史版本
                  </span>
                )}
              </div>

              {ann.previousVersionId && (
                <div className="flex items-center gap-1">
                  <Link className="w-3 h-3 text-[#6b7894]" />
                  <span className="text-[#6b7894] text-xs">
                    更正自: {ann.previousVersionId}
                  </span>
                </div>
              )}

              <pre className="text-[#f0ece4] text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {ann.content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

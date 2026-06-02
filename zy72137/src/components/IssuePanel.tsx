import { useStore } from "@/store/useStore";
import { useExpiredRecords, useTimecodeIssueRecords, useDuplicateRecords } from "@/hooks/useDerived";
import StatusBadge, { IssueBadge } from "./StatusBadge";
import { Clock, AlertTriangle, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { SampleRecord } from "@/types";

function IssueSection({
  title,
  icon,
  records,
  accentColor,
  isOpen,
  onToggle,
  renderDetail,
}: {
  title: string;
  icon: React.ReactNode;
  records: SampleRecord[];
  accentColor: string;
  isOpen: boolean;
  onToggle: () => void;
  renderDetail: (r: SampleRecord) => React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border overflow-hidden`} style={{ borderColor: `color-mix(in srgb, ${accentColor} 30%, transparent)` }}>
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-zinc-800/60 hover:bg-zinc-800 transition-colors text-left"
        onClick={onToggle}
      >
        {icon}
        <span className="text-sm font-medium text-zinc-200 flex-1">{title}</span>
        <span
          className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-xs font-bold"
          style={{
            color: accentColor,
            backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
          }}
        >
          {records.length}
        </span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        )}
      </button>
      {isOpen && records.length > 0 && (
        <div className="border-t border-zinc-700/40 bg-zinc-900/40">
          {records.map((r) => (
            <div
              key={r.id}
              className="px-4 py-2.5 border-t border-zinc-800/60 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-zinc-200">{r.trackName}</span>
                <StatusBadge status={r.authorizationStatus} />
                {r.isManualRename && <IssueBadge type="rename" />}
              </div>
              <div className="text-[10px] text-zinc-500">{renderDetail(r)}</div>
            </div>
          ))}
        </div>
      )}
      {isOpen && records.length === 0 && (
        <div className="px-4 py-3 text-xs text-zinc-600 border-t border-zinc-700/40">
          该类别暂无问题记录
        </div>
      )}
    </div>
  );
}

export default function IssuePanel() {
  const expiredRecords = useExpiredRecords();
  const timecodeRecords = useTimecodeIssueRecords();
  const duplicateRecords = useDuplicateRecords();
  const setFilter = useStore((s) => s.setFilter);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    expired: true,
    timecode: true,
    duplicate: true,
  });

  const toggle = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filterToIssue = (type: string) => {
    setFilter({ issueTypes: [type], authorizationStatus: [] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-zinc-300">问题面板</h3>
      </div>

      <IssueSection
        title="授权过期"
        icon={<Clock className="w-4 h-4 text-red-400" />}
        records={expiredRecords}
        accentColor="#f87171"
        isOpen={openSections.expired}
        onToggle={() => toggle("expired")}
        renderDetail={(r) => (
          <div className="flex items-center gap-3">
            <span>到期日: {r.authorizationExpiry || "无"}</span>
            <span>来源: {r.originalFileName}</span>
            <button
              className="text-red-400/70 hover:text-red-300 underline"
              onClick={(e) => {
                e.stopPropagation();
                filterToIssue("expired");
              }}
            >
              筛选此类
            </button>
          </div>
        )}
      />

      <IssueSection
        title="时码错位"
        icon={<AlertTriangle className="w-4 h-4 text-sky-400" />}
        records={timecodeRecords}
        accentColor="#38bdf8"
        isOpen={openSections.timecode}
        onToggle={() => toggle("timecode")}
        renderDetail={(r) => (
          <div className="flex items-center gap-3">
            <span>
              时码: {r.timecodeStart || "—"} → {r.timecodeEnd || "—"}
            </span>
            <span>时长: {r.duration ? r.duration + "s" : "未知"}</span>
            <button
              className="text-sky-400/70 hover:text-sky-300 underline"
              onClick={(e) => {
                e.stopPropagation();
                filterToIssue("timecode");
              }}
            >
              筛选此类
            </button>
          </div>
        )}
      />

      <IssueSection
        title="重复曲目"
        icon={<Copy className="w-4 h-4 text-violet-400" />}
        records={duplicateRecords}
        accentColor="#a78bfa"
        isOpen={openSections.duplicate}
        onToggle={() => toggle("duplicate")}
        renderDetail={(r) => (
          <div className="flex items-center gap-3">
            <span>组: {r.duplicateGroupId || "—"}</span>
            <span>文件: {r.originalFileName}</span>
            <button
              className="text-violet-400/70 hover:text-violet-300 underline"
              onClick={(e) => {
                e.stopPropagation();
                filterToIssue("duplicate");
              }}
            >
              筛选此类
            </button>
          </div>
        )}
      />
    </div>
  );
}

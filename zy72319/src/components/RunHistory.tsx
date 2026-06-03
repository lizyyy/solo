import useAppStore from "@/store/useAppStore";
import type { MaterialSource } from "@/types";

const modeLabels: Record<MaterialSource, string> = {
  normal: "正常",
  mismatch: "错口径",
  supplementary: "补录",
};

const modeColors: Record<MaterialSource, string> = {
  normal: "text-[#0ff0b3]",
  mismatch: "text-[#ff9f1c]",
  supplementary: "text-[#4488ff]",
};

export default function RunHistory() {
  const runRecords = useAppStore((s) => s.runRecords);
  const sorted = [...runRecords].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[#8888aa] text-sm">
        暂无运行记录
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#2a2a4a]" />

      <div className="flex flex-col gap-4">
        {sorted.map((record) => {
          const ts = new Date(record.timestamp);
          const formatted = ts.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <div key={record.id} className="relative flex items-start gap-4 pl-6">
              <div className="absolute left-0 top-2.5 h-3.5 w-3.5 rounded-full bg-[#16163a] border-2 border-[#0ff0b3] z-10" />

              <div className="flex-1 rounded-lg bg-[#16163a] border border-[#2a2a4a] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${modeColors[record.mode]}`}>
                    {modeLabels[record.mode]}
                  </span>
                  <span className="text-xs text-[#8888aa]">{formatted}</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <span className="text-[#0ff0b3]">正常 {record.summary.normalCount}</span>
                  <span className="text-[#ff9f1c]">边界 {record.summary.boundaryCount}</span>
                  <span className="text-[#ff4444]">冲突 {record.summary.conflictCount}</span>
                  <span className="text-[#8888aa]">待审 {record.summary.pendingReviewCount}</span>
                </div>

                <p className="mt-1 text-xs text-[#8888aa]">
                  反例数：{record.summary.totalCounterExamples}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

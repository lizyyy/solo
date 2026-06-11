import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FileText, ChevronRight, AlertTriangle, FileX } from "lucide-react";
import { usePreReviewStore } from "@/store/preReviewStore";

export default function VisaList() {
  const { getVisaNos, getVisaLinesByNo, collisions } = usePreReviewStore();
  const visaNos = useMemo(() => getVisaNos(), [getVisaNos]);

  const visaSummary = useMemo(() => {
    return visaNos.map((no) => {
      const lines = getVisaLinesByNo(no);
      const bias = lines.filter((l) => l.causesBias).length;
      const relatedCols = lines
        .map((l) => collisions.find((c) => c.id === l.collisionId))
        .filter(Boolean);
      const rejected = relatedCols.filter((c) => c?.status === "rejected").length;
      return { no, lines: lines.length, bias, rejected, date: no.replace("V-2026-", "2026-") };
    });
  }, [visaNos, getVisaLinesByNo, collisions]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-ink-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          现场签证单
        </h1>
        <p className="text-xs text-ink-500 mt-0.5">选择签证单查看行级追踪 · 红色标记表示拖偏预审</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {visaSummary.map((v) => (
          <Link
            key={v.no}
            to={`/visa/${v.no}`}
            className="group rounded-lg border border-ink-800 bg-ink-900/60 p-4 hover:border-amber-500/40 hover:bg-ink-850 transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-ink-500">签证号</div>
                <div className="mt-0.5 font-mono-num text-base text-ink-100">{v.no}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-ink-600 group-hover:text-amber-400 transition" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div>
                <div className="text-[10px] text-ink-500 uppercase tracking-wider">行</div>
                <div className="mt-0.5 font-mono-num text-sm text-ink-200">{v.lines}</div>
              </div>
              <div>
                <div className="text-[10px] text-ink-500 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                  拖偏
                </div>
                <div className={`mt-0.5 font-mono-num text-sm ${v.bias > 0 ? "text-red-400" : "text-ink-400"}`}>
                  {v.bias}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-ink-500 uppercase tracking-wider flex items-center gap-1">
                  <FileX className="w-2.5 h-2.5 text-amber-400" />
                  退回
                </div>
                <div className={`mt-0.5 font-mono-num text-sm ${v.rejected > 0 ? "text-amber-400" : "text-ink-400"}`}>
                  {v.rejected}
                </div>
              </div>
            </div>
            {v.bias > 0 && (
              <div className="mt-3 text-[11px] text-red-300/90 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                含 {v.bias} 行超偏差阈值,可能拖偏预审结论
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

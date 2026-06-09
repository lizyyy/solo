import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, FileDigit, Ruler } from 'lucide-react';
import { useReviewStore } from '@/store/reviewStore';

export default function OffsetWarningBar() {
  const { currentVersion, summary, toggleGuideDrawer } = useReviewStore();
  const [open, setOpen] = useState(false);

  if (!summary.hasCoordinateOffset || currentVersion.missingMaterials.length === 0) return null;

  return (
    <div className="w-full bg-eng-alert border-b-2 border-red-400 z-20 relative">
      <div className="px-4 py-2 flex items-center gap-3 text-white">
        <div className="p-1 border border-white/40 rounded-sm">
          <AlertTriangle size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold flex items-center gap-2 flex-wrap">
            <span>⚠ 当前版本坐标整体偏移</span>
            <span className="font-mono text-yellow-200 bg-red-900/50 px-1.5 py-0.5">
              <Ruler size={12} className="inline mr-1" />
              {summary.offsetMm} mm
            </span>
            <span className="text-xs opacity-80 font-mono">版本 {currentVersion.tag} · {currentVersion.label}</span>
          </div>
          <div className="text-[11px] opacity-90 mt-0.5 truncate">
            本版复核结论仅供参考，补全以下 {currentVersion.missingMaterials.length} 份材料后方可正式判定。接手人请按顺序补充。
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => toggleGuideDrawer(true)}
            className="flex items-center gap-1 text-xs border border-white/40 px-2 py-1 hover:bg-white/10 transition-colors"
          >
            <ExternalLink size={11} /> 接手人指引
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-xs border border-white/40 px-2 py-1 hover:bg-white/10 transition-colors"
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {open ? '收起清单' : '补材清单'}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-red-400/50 bg-red-950/60 px-5 py-3 space-y-2">
          <div className="text-[11px] text-yellow-200 font-mono mb-1 flex items-center gap-1">
            <FileDigit size={12} /> 请按以下优先级顺序补充材料，补完后回到最新版重新复核：
          </div>
          {currentVersion.missingMaterials.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-2 border border-red-400/30 bg-black/20 text-xs"
            >
              <span className="shrink-0 w-5 h-5 flex items-center justify-center font-mono text-sm font-bold bg-yellow-300 text-red-950">
                {idx + 1}
              </span>
              <span className="text-white leading-relaxed">{item}</span>
            </div>
          ))}
          <div className="text-[10px] text-red-200/80 pt-1 font-mono">
            提示：补全① → 现场核对柱位 → 设计院重出CAD(②) → 标注对比截图(③) → 切换到后续版本(如 v2024.05.08)查看修正结果
          </div>
        </div>
      )}
    </div>
  );
}

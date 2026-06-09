import { useReviewStore } from '@/store/reviewStore';
import { SOURCE_COLORS, SOURCE_LABELS } from '@/types';
import { AlertTriangle, ClipboardCheck, Clock, FileX2, type LucideIcon } from 'lucide-react';

const CONCLUSION_STYLE: Record<string, { bg: string; fg: string; border: string; icon: LucideIcon }> = {
  通过: { bg: 'bg-eng-pass/15', fg: 'text-eng-pass', border: 'border-eng-pass', icon: ClipboardCheck },
  待定: { bg: 'bg-eng-warn/15', fg: 'text-eng-warn', border: 'border-eng-warn', icon: Clock },
  驳回: { bg: 'bg-eng-alert/15', fg: 'text-eng-alert', border: 'border-eng-alert', icon: FileX2 },
};

export default function SummaryCard() {
  const { summary, selectedZone, toggleHistoryPanel, showHistoryPanel } = useReviewStore();

  const cStyle = CONCLUSION_STYLE[summary.overallConclusion];
  const CIcon = cStyle.icon;

  return (
    <div className="eng-panel w-[320px] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-eng-muted font-mono">当前版本</div>
          <div className="font-mono text-sm text-eng-text mt-0.5">{summary.currentVersion}</div>
        </div>
        {summary.hasCoordinateOffset && (
          <div className="flex items-center gap-1 eng-tag border-eng-alert text-eng-alert">
            <AlertTriangle size={11} /> 偏移 {summary.offsetMm}mm
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="border border-eng-border p-2">
          <div className="text-[10px] text-eng-muted">总分区</div>
          <div className="font-mono text-lg text-eng-dim">{summary.totalZones}</div>
        </div>
        <div className="border border-eng-border p-2">
          <div className="text-[10px] text-eng-muted">已复核</div>
          <div className="font-mono text-lg text-eng-pass">{summary.reviewedCount}</div>
        </div>
        <div className="border border-eng-border p-2">
          <div className="text-[10px] text-eng-muted">存疑/驳回</div>
          <div className="font-mono text-lg">
            <span className="text-eng-warn">{summary.pendingCount}</span>
            <span className="text-eng-muted">/</span>
            <span className="text-eng-alert">{summary.rejectedCount}</span>
          </div>
        </div>
      </div>

      <div className={`border ${cStyle.border} ${cStyle.bg} p-3 flex items-center gap-3`}>
        <div className={`p-2 border ${cStyle.border}`}>
          <CIcon size={20} className={cStyle.fg} />
        </div>
        <div className="flex-1">
          <div className={`text-lg font-bold ${cStyle.fg}`}>结论：{summary.overallConclusion}</div>
          <div className="text-[10px] text-eng-muted mt-0.5">
            {summary.hasCoordinateOffset
              ? '⚠ 坐标偏移存在，本版结论仅供参考'
              : '基于当前版本与筛选条件计算'}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs text-eng-muted mb-1.5">影响结论的关键材料来源</div>
        {summary.keyInfluencingMaterials.length === 0 ? (
          <div className="text-[10px] text-eng-muted eng-panel p-2">
            当前筛选条件下无影响结论的材料
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {summary.keyInfluencingMaterials.map((m) => (
              <span
                key={m.source}
                className="eng-tag"
                style={{ borderColor: SOURCE_COLORS[m.source], color: SOURCE_COLORS[m.source] }}
              >
                {SOURCE_LABELS[m.source]} × {m.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {selectedZone && (
        <div className="border-t border-eng-border pt-3">
          <div className="text-[10px] text-eng-muted mb-1">已选分区</div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="font-mono text-eng-warn">{selectedZone.id}</span>
              <span className="text-eng-dim mx-1">·</span>
              <span className="text-eng-text">{selectedZone.name}</span>
            </div>
            <button
              onClick={toggleHistoryPanel}
              className="eng-btn text-xs py-1"
              title="查看/隐藏历史追溯面板"
            >
              {showHistoryPanel ? '收起历史' : '追溯历史'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

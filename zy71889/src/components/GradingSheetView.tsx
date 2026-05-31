import { FileText, Download, RefreshCw, ExternalLink } from 'lucide-react';
import type { GradingSheet, GradingItem } from '@shared/types';
import { useLabStore } from '@/store/useLabStore';

interface GradingSheetViewProps {
  batchId: string;
  onEvidenceClick?: (evidenceId: string) => void;
}

export function GradingSheetView({ batchId, onEvidenceClick }: GradingSheetViewProps) {
  const gradingSheet = useLabStore((state) => state.gradingSheet);
  const loading = useLabStore((state) => state.loading.grading);
  const fetchGradingSheet = useLabStore((state) => state.fetchGradingSheet);
  const generateGradingSheet = useLabStore((state) => state.generateGradingSheet);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse-soft space-y-4">
          <div className="h-6 bg-ink-100 rounded w-1/3" />
          <div className="h-4 bg-ink-100 rounded w-full" />
          <div className="h-20 bg-ink-100 rounded" />
          <div className="h-4 bg-ink-100 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!gradingSheet) {
    return (
      <div className="card p-6 text-center">
        <FileText size={32} className="mx-auto text-ink-300 mb-3" />
        <p className="text-ink-500 mb-4">暂无批改表</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => fetchGradingSheet(batchId)}
            className="btn flex items-center gap-2"
          >
            <RefreshCw size={14} />
            刷新
          </button>
          <button
            onClick={() => generateGradingSheet(batchId)}
            className="btn btn-primary flex items-center gap-2"
          >
            <FileText size={14} />
            生成批改表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="p-4 border-b border-ink-200">
        <div className="flex items-center justify-between">
          <h3 className="section-title mb-0 border-none flex items-center gap-2">
            <FileText size={16} />
            实验批改表
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => generateGradingSheet(batchId)}
              className="btn text-xs py-1 px-2 flex items-center gap-1"
              title="重新生成"
            >
              <RefreshCw size={12} />
              重新生成
            </button>
            <button
              onClick={() => window.print()}
              className="btn text-xs py-1 px-2 flex items-center gap-1"
              title="导出"
            >
              <Download size={12} />
              导出
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-baseline gap-1">
            <span className="font-serif text-4xl font-semibold text-ink-800">
              {gradingSheet.totalScore.toFixed(1)}
            </span>
            <span className="text-ink-400">/ {gradingSheet.maxScore}</span>
          </div>
          <div className="mt-2 w-48 h-2 bg-ink-100 mx-auto overflow-hidden">
            <div
              className={`h-full ${
                gradingSheet.totalScore >= 90 ? 'bg-moss-500' :
                gradingSheet.totalScore >= 60 ? 'bg-amber-500' : 'bg-brick-500'
              }`}
              style={{ width: `${(gradingSheet.totalScore / gradingSheet.maxScore) * 100}%` }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200">
                <th className="text-left py-2 px-3 font-medium text-ink-600">评分项</th>
                <th className="text-center py-2 px-3 font-medium text-ink-600 w-24">得分</th>
                <th className="text-center py-2 px-3 font-medium text-ink-600 w-24">满分</th>
                <th className="text-left py-2 px-3 font-medium text-ink-600">说明</th>
                <th className="text-left py-2 px-3 font-medium text-ink-600 w-32">证据</th>
              </tr>
            </thead>
            <tbody>
              {gradingSheet.items.map((item: GradingItem, idx) => (
                <tr key={idx} className="border-b border-ink-100 hover:bg-ink-50">
                  <td className="py-2 px-3 text-ink-800">{item.name}</td>
                  <td className="py-2 px-3 text-center font-mono text-ink-800">
                    {item.score.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-ink-400">
                    {item.maxScore}
                  </td>
                  <td className="py-2 px-3 text-ink-600 text-xs">{item.comment}</td>
                  <td className="py-2 px-3">
                    {item.evidenceIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.evidenceIds.slice(0, 3).map((id) => (
                          <button
                            key={id}
                            onClick={() => onEvidenceClick?.(id)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-ink-50 text-ink-600 border border-ink-200 hover:bg-ink-100 transition-colors"
                            title={`查看证据 #${id.slice(0, 8)}`}
                          >
                            <ExternalLink size={10} />
                            {id.slice(0, 6)}
                          </button>
                        ))}
                        {item.evidenceIds.length > 3 && (
                          <span className="text-xs text-ink-400">+{item.evidenceIds.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-ink-50 font-medium">
                <td className="py-3 px-3 text-ink-800">合计</td>
                <td className="py-3 px-3 text-center font-mono text-ink-800">
                  {gradingSheet.totalScore.toFixed(1)}
                </td>
                <td className="py-3 px-3 text-center font-mono text-ink-400">
                  {gradingSheet.maxScore}
                </td>
                <td colSpan={2} className="py-3 px-3" />
              </tr>
            </tbody>
          </table>
        </div>

        {gradingSheet.finalComment && (
          <div className="mt-4 p-3 bg-ink-50 border border-ink-200">
            <h5 className="font-serif text-sm text-ink-700 mb-1">总评</h5>
            <p className="text-sm text-ink-600">{gradingSheet.finalComment}</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { X, Download, FileSpreadsheet, FileText, AlertTriangle, Info } from 'lucide-react';
import type { Problem, ReviewResult, FilterCriteria } from '@/types';
import { getExportPreview, exportToCSV, exportToExcel } from '@/services/exportService';

interface ExportModalProps {
  problems: Problem[];
  reviewResults: ReviewResult[];
  filterCriteria: FilterCriteria;
  activeGroup: 'A' | 'B';
  onClose: () => void;
}

export default function ExportModal({
  problems,
  reviewResults,
  filterCriteria,
  activeGroup,
  onClose,
}: ExportModalProps) {
  const preview = getExportPreview({ problems, reviewResults, filterCriteria, groupId: activeGroup });

  const handleExportCSV = () => {
    exportToCSV({ problems, reviewResults, filterCriteria, groupId: activeGroup });
  };

  const handleExportExcel = () => {
    exportToExcel({ problems, reviewResults, filterCriteria, groupId: activeGroup });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-academic-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up">
        <div className="px-6 py-4 border-b border-academic-100 bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              导出复核报告
            </h2>
            <p className="text-xs text-amber-100 mt-0.5">
              参数组 {activeGroup} · 共 {preview.totalCount} 条题目
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="card-academic p-4 border-l-4 border-l-academic-500">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-academic-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-academic-700 mb-1">筛选口径（将附在导出文件中）</p>
                <p className="text-sm font-mono text-academic-800 bg-academic-50 px-3 py-2 rounded">
                  {preview.filterSummary}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            <Stat label="总数" value={preview.totalCount} tone="academic" />
            <Stat label="正常" value={preview.normalCount} tone="normal" />
            <Stat label="异常" value={preview.abnormalCount} tone="abnormal" />
            <Stat label="单位问题" value={preview.unitIssueCount} tone="unit" />
            <Stat label="待复核" value={preview.pendingCount} tone="pending" />
          </div>

          {preview.problematicRows.length > 0 && (
            <div className="card-academic p-4 border-l-4 border-l-status-abnormal">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-status-abnormal mt-0.5 flex-shrink-0" />
                <p className="text-xs font-semibold text-status-abnormal">
                  问题行定位（按偏差降序，报告中会标注）
                </p>
              </div>
              <div className="space-y-2">
                {preview.problematicRows.map((row) => (
                  <div
                    key={row.problemId}
                    className="flex items-center justify-between py-2 px-3 bg-status-abnormal/5 rounded text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-status-abnormal font-bold bg-status-abnormal/10 px-2 py-0.5 rounded">
                        行 {row.rowNumber}
                      </span>
                      <span className="font-mono text-xs text-academic-500">{row.problemId}</span>
                      <span className="text-academic-700 text-xs max-w-[280px] truncate">{row.title}</span>
                    </div>
                    <span className="font-mono text-xs text-status-abnormal font-semibold">
                      偏差 {(row.deviation * 100).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {problems.some((p) => p.hasUnitIssue) && (
            <div className="card-academic p-4 border-l-4 border-l-status-unit">
              <p className="text-xs font-semibold text-status-unit mb-2">
                单位缺失记录（将在独立 Sheet/Section 中展示，不混入正常结果）
              </p>
              <div className="flex flex-wrap gap-2">
                {problems.filter((p) => p.hasUnitIssue).map((p) => (
                  <span key={p.id} className="font-mono text-xs text-status-unit bg-status-unit/10 px-2 py-1 rounded">
                    {p.id} · 行 {p.originalRow}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-academic-100">
            <p className="text-xs font-semibold text-academic-700 mb-3">选择导出格式</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-3 p-4 border border-academic-200 rounded-lg hover:border-academic-400 hover:bg-academic-50 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-academic-800">CSV 格式</p>
                  <p className="text-xs text-academic-500">通用格式，兼容 Excel</p>
                </div>
                <Download className="w-4 h-4 text-academic-400 ml-auto group-hover:text-academic-600" />
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-3 p-4 border border-academic-200 rounded-lg hover:border-academic-400 hover:bg-academic-50 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-academic-800">Excel 格式</p>
                  <p className="text-xs text-academic-500">多 Sheet，含摘要/明细/单位问题</p>
                </div>
                <Download className="w-4 h-4 text-academic-400 ml-auto group-hover:text-academic-600" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const colorMap: Record<string, string> = {
    academic: 'text-academic-600 bg-academic-50',
    normal: 'text-status-normal bg-status-normal/10',
    abnormal: 'text-status-abnormal bg-status-abnormal/10',
    unit: 'text-status-unit bg-status-unit/10',
    pending: 'text-status-pending bg-status-pending/10',
  };

  return (
    <div className={`${colorMap[tone]} rounded-lg p-3 text-center`}>
      <p className="text-2xl font-display font-bold tabular-nums">{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  );
}

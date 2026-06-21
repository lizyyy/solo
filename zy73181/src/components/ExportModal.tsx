import { X, Download, FileSpreadsheet, FileText, AlertTriangle, Info, AlertCircle, FileEdit } from 'lucide-react';
import type { Problem, ReviewResult, FilterCriteria, ProblematicRowInfo } from '@/types';
import { getExportPreview, exportToCSV, exportToExcel } from '@/services/exportService';
import {
  remarkStatusLabel,
  unitStatusLabel,
  judgmentLabel,
} from '@/services/filterService';

interface ExportModalProps {
  problems: Problem[];
  reviewResults: ReviewResult[];
  reviewResultsA: ReviewResult[];
  reviewResultsB: ReviewResult[];
  filterCriteria: FilterCriteria;
  activeGroup: 'A' | 'B';
  onClose: () => void;
}

export default function ExportModal({
  problems,
  reviewResultsA,
  reviewResultsB,
  filterCriteria,
  activeGroup,
  onClose,
}: ExportModalProps) {
  const preview = getExportPreview({
    problems,
    reviewResultsA,
    reviewResultsB,
    filterCriteria,
    activeGroup,
  });
  const { statistics, problematicRows, unitIssueRows } = preview;

  const handleExportCSV = () => {
    exportToCSV({ problems, reviewResultsA, reviewResultsB, filterCriteria, activeGroup });
  };
  const handleExportExcel = () => {
    exportToExcel({ problems, reviewResultsA, reviewResultsB, filterCriteria, activeGroup });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-academic-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-fade-in-up flex flex-col">
        <div className="px-6 py-4 border-b border-academic-100 bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              导出复核报告
            </h2>
            <p className="text-xs text-amber-100 mt-0.5">
              参数组 {activeGroup} · 共 {statistics.total} 条题目 · 筛选口径与屏幕一致
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="card-academic p-4 border-l-4 border-l-academic-500">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-academic-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-academic-700 mb-1">筛选口径（将附在导出文件首行）</p>
                <p className="text-sm font-mono text-academic-800 bg-academic-50 px-3 py-2 rounded break-all">
                  {preview.filterSummary}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            <Stat label="总数" value={statistics.total} tone="academic" />
            <Stat label="正常" value={statistics.normal} tone="normal" />
            <Stat label="异常" value={statistics.abnormal} tone="abnormal" />
            <Stat label="单位问题" value={statistics.unitIssue} tone="unit" />
            <Stat label="待复核" value={statistics.pending} tone="pending" />
          </div>

          {problematicRows.length > 0 && (
            <div className="card-academic p-4 border-l-4 border-l-status-abnormal">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-status-abnormal mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-status-abnormal">
                    拖偏复核边界的异常行（按偏差降序，最多前5条，报告中包含判定变化和换算详情）
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-academic-50 rounded text-[11px] font-semibold text-academic-600">
                  <span className="col-span-1">行号</span>
                  <span className="col-span-2">题目</span>
                  <span className="col-span-1">备注</span>
                  <span className="col-span-1">单位</span>
                  <span className="col-span-2">原始值/单位</span>
                  <span className="col-span-2">换算值/单位</span>
                  <span className="col-span-2">判定变化</span>
                  <span className="col-span-1 text-right">偏差</span>
                </div>
                {problematicRows.map((row: ProblematicRowInfo) => (
                  <div
                    key={row.problemId}
                    className="grid grid-cols-12 gap-2 items-center py-2 px-3 bg-status-abnormal/5 rounded"
                  >
                    <span className="col-span-1 font-mono font-bold text-status-abnormal">{row.originalRow}</span>
                    <span className="col-span-2">
                      <span className="font-mono text-academic-700 font-semibold">{row.problemId}</span>
                      <p className="text-[10px] text-academic-500 truncate">{row.title}</p>
                    </span>
                    <span className={`col-span-1 inline-flex items-center gap-1 ${
                      row.remarkStatus === 'supplementary' ? 'text-amber-700' :
                      row.remarkStatus === 'normal' ? 'text-academic-600' : 'text-academic-400'
                    }`}>
                      {row.remarkStatus === 'supplementary' && <FileEdit className="w-3 h-3" />}
                      {remarkStatusLabel(row.remarkStatus)}
                    </span>
                    <span className={`col-span-1 ${
                      row.unitStatus === 'present' ? 'text-status-normal' :
                      row.unitStatus === 'missing' ? 'text-status-unit font-semibold' : 'text-status-abnormal'
                    }`}>
                      {unitStatusLabel(row.unitStatus)}
                    </span>
                    <span className="col-span-2 font-mono text-academic-700">
                      {row.rawBoundaryValue ?? '-'} {row.rawBoundaryUnit ?? ''}
                    </span>
                    <span className="col-span-2 font-mono text-academic-700">
                      {row.convertedValue ?? '-'} {row.convertedUnit ?? ''}
                    </span>
                    <span className={`col-span-2 ${
                      row.judgmentChanged ? 'text-status-abnormal font-semibold' : 'text-academic-500'
                    }`}>
                      {row.judgmentChanged
                        ? `${judgmentLabel(row.judgmentA)}→${judgmentLabel(row.judgmentB)}`
                        : '无变化'}
                    </span>
                    <span className="col-span-1 text-right font-mono text-status-abnormal font-semibold">
                      {(row.deviation * 100).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unitIssueRows.length > 0 && (
            <div className="card-academic p-4 border-l-4 border-l-status-unit">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-status-unit mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-status-unit mb-1">
                    单位缺失/不匹配清单（独立展示，不混入正常/异常统计）
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {unitIssueRows.map((row: ProblematicRowInfo) => (
                  <div
                    key={row.problemId}
                    className="flex items-center justify-between py-2 px-3 bg-status-unit/5 rounded text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-status-unit font-bold bg-status-unit/10 px-2 py-0.5 rounded">
                        行 {row.originalRow}
                      </span>
                      <span className="font-mono text-xs text-academic-700 font-semibold">{row.problemId}</span>
                      <span className="text-academic-600 max-w-[200px] truncate">{row.title}</span>
                      {row.remarkStatus === 'supplementary' && (
                        <span className="inline-flex items-center gap-1 text-amber-700 text-[11px]">
                          <FileEdit className="w-3 h-3" />后补备注
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        row.unitStatus === 'missing'
                          ? 'bg-status-unit/10 text-status-unit'
                          : 'bg-status-abnormal/10 text-status-abnormal'
                      }`}>
                        {unitStatusLabel(row.unitStatus)}
                      </span>
                      <span className="text-[11px] text-academic-500">
                        原因：{row.unitStatus === 'missing' ? '单位缺失未参与统计' : '单位不匹配需人工确认'}
                      </span>
                    </div>
                  </div>
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
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold text-academic-800">CSV 格式</p>
                  <p className="text-xs text-academic-500">通用格式，含筛选口径、问题行、单位缺失段</p>
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
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold text-academic-800">Excel 格式</p>
                  <p className="text-xs text-academic-500">三 Sheet：报告摘要/题目明细/单位问题</p>
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

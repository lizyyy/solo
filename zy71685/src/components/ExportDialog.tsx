import React, { useState } from 'react';
import { useAppStore } from '@/store';
import {
  X,
  FileDown,
  FileText,
  Table,
  CheckCircle2,
  AlertCircle,
  Filter,
  Clock,
  Music,
  Users,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  formatTime,
  PROBLEM_TYPE_LABELS,
  CONFIRMATION_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  PROBLEM_TYPE_COLORS,
} from '@/types';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const {
    exportReport,
    viewRange,
    filters,
    filteredMisnotes,
    statistics,
    voiceParts,
    currentRehearsal,
  } = useAppStore();

  const [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeMisnoteList, setIncludeMisnoteList] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedVoiceParts = voiceParts.filter((vp) =>
    filters.voicePartIds.includes(vp.id)
  );

  const getFilterSummary = () => {
    const parts: string[] = [];

    if (filters.voicePartIds.length > 0) {
      parts.push(
        `声部: ${selectedVoiceParts.map((vp) => vp.studentName).join('、')}`
      );
    }

    if (filters.problemTypes.length > 0) {
      parts.push(
        `问题: ${filters.problemTypes
          .map((t) => PROBLEM_TYPE_LABELS[t])
          .join('、')}`
      );
    }

    if (filters.confirmationStatuses.length > 0) {
      parts.push(
        `状态: ${filters.confirmationStatuses
          .map((s) => CONFIRMATION_STATUS_LABELS[s])
          .join('、')}`
      );
    }

    if (filters.sourceTypes.length > 0) {
      parts.push(
        `来源: ${filters.sourceTypes
          .map((s) => SOURCE_TYPE_LABELS[s])
          .join('、')}`
      );
    }

    if (filters.minConfidence > 0) {
      parts.push(`置信度≥${(filters.minConfidence * 100).toFixed(0)}%`);
    }

    if (filters.maxDeviation < 500) {
      parts.push(`偏差≤${filters.maxDeviation}音分`);
    }

    return parts.length > 0 ? parts : ['无筛选条件'];
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setExportSuccess(false);

    try {
      await exportReport(format, includeCharts);
      setExportSuccess(true);
      setTimeout(() => {
        onClose();
        setExportSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      onClose();
      setExportSuccess(false);
      setError(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-bg-card rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileDown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">导出报告</h2>
              <p className="text-sm text-text-secondary">
                导出当前视图范围和筛选条件的数据
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-subtle transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-text-primary">
                导出范围说明
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-text-tertiary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-text-secondary">时间范围: </span>
                  <span className="text-text-primary font-mono">
                    {formatTime(viewRange[0])} - {formatTime(viewRange[1])}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Filter className="w-4 h-4 text-text-tertiary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-text-secondary">筛选条件: </span>
                  <div className="inline-flex flex-wrap gap-1 ml-1">
                    {getFilterSummary().map((f, i) => (
                      <span
                        key={i}
                        className="text-xs bg-bg-subtle px-2 py-0.5 rounded text-text-primary"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Music className="w-4 h-4 text-text-tertiary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-text-secondary">错音数量: </span>
                  <span className="text-text-primary font-semibold">
                    {filteredMisnotes.length} 个
                  </span>
                </div>
              </div>
              {currentRehearsal && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-text-tertiary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-text-secondary">排练: </span>
                    <span className="text-text-primary">{currentRehearsal.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {statistics && (
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-3">
                统计摘要
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-bg-subtle rounded-lg text-center">
                  <div className="text-2xl font-bold text-text-primary mb-1">
                    {statistics.total}
                  </div>
                  <div className="text-xs text-text-secondary">总计</div>
                </div>
                {(['voice_overlap', 'section_misalignment', 'noise_misjudgment'] as const).map(
                  (type) => (
                    <div
                      key={type}
                      className="p-3 bg-bg-subtle rounded-lg text-center"
                    >
                      <div
                        className={`text-2xl font-bold mb-1 ${PROBLEM_TYPE_COLORS[type]}`}
                      >
                        {statistics.byProblemType[type]}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {PROBLEM_TYPE_LABELS[type]}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-text-primary mb-3">
              导出格式
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  format === 'pdf'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-border-hover bg-bg-subtle'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      format === 'pdf' ? 'bg-primary/20' : 'bg-bg-card'
                    }`}
                  >
                    <FileText
                      className={`w-5 h-5 ${
                        format === 'pdf' ? 'text-primary' : 'text-text-secondary'
                      }`}
                    />
                  </div>
                  <div>
                    <div
                      className={`font-medium ${
                        format === 'pdf' ? 'text-primary' : 'text-text-primary'
                      }`}
                    >
                      PDF 文档
                    </div>
                    <div className="text-xs text-text-secondary">
                      适合打印和分享
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setFormat('xlsx')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  format === 'xlsx'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-border-hover bg-bg-subtle'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      format === 'xlsx' ? 'bg-primary/20' : 'bg-bg-card'
                    }`}
                  >
                    <Table
                      className={`w-5 h-5 ${
                        format === 'xlsx' ? 'text-primary' : 'text-text-secondary'
                      }`}
                    />
                  </div>
                  <div>
                    <div
                      className={`font-medium ${
                        format === 'xlsx' ? 'text-primary' : 'text-text-primary'
                      }`}
                    >
                      Excel 表格
                    </div>
                    <div className="text-xs text-text-secondary">
                      适合数据分析
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-text-primary mb-3">
              导出内容
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-bg-subtle rounded-lg cursor-pointer hover:bg-bg-subtle/80 transition-colors">
                <button
                  type="button"
                  onClick={() => setIncludeCharts(!includeCharts)}
                  className="text-primary"
                >
                  {includeCharts ? (
                    <CheckSquare className="w-5 h-5" />
                  ) : (
                    <Square className="w-5 h-5 text-text-tertiary" />
                  )}
                </button>
                <div>
                  <div className="text-sm text-text-primary">包含统计图表</div>
                  <div className="text-xs text-text-secondary">
                    错音分布、问题类型占比等可视化图表
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-bg-subtle rounded-lg cursor-pointer hover:bg-bg-subtle/80 transition-colors">
                <button
                  type="button"
                  onClick={() => setIncludeMisnoteList(!includeMisnoteList)}
                  className="text-primary"
                >
                  {includeMisnoteList ? (
                    <CheckSquare className="w-5 h-5" />
                  ) : (
                    <Square className="w-5 h-5 text-text-tertiary" />
                  )}
                </button>
                <div>
                  <div className="text-sm text-text-primary">包含错音列表</div>
                  <div className="text-xs text-text-secondary">
                    每个错音的详细信息（时间、声部、偏差等）
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-bg-subtle rounded-lg cursor-pointer hover:bg-bg-subtle/80 transition-colors">
                <button
                  type="button"
                  onClick={() => setIncludeComments(!includeComments)}
                  className="text-primary"
                >
                  {includeComments ? (
                    <CheckSquare className="w-5 h-5" />
                  ) : (
                    <Square className="w-5 h-5 text-text-tertiary" />
                  )}
                </button>
                <div>
                  <div className="text-sm text-text-primary">包含备注信息</div>
                  <div className="text-xs text-text-secondary">
                    老师和学生添加的备注内容
                  </div>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {exportSuccess && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-400">导出成功！</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-bg-subtle">
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="px-5 py-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || exportSuccess}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                导出 {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

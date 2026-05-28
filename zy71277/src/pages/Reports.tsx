import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Download,
  Eye,
  ArrowUpCircle,
  RotateCcw,
  PlusCircle,
  AlertTriangle,
  FileText,
  X,
  Check,
} from 'lucide-react';
import type {
  DriftReport,
  DriftResult,
  ErrorCause,
  ClassNote,
  SegmentStat,
  AnomalyRegion,
} from '../../shared/types';
import { cn } from '@/lib/utils';
import DriftCurve from '@/components/DriftCurve';
import SegmentStats from '@/components/SegmentStats';

type StatusFilter = 'all' | 'submitted' | 'supplementary' | 'withdrawn' | 'duplicate';

interface ReportDetail {
  report: DriftReport;
  result: DriftResult | null;
  errors: ErrorCause[];
  notes: ClassNote[];
  filename?: string;
}

const statusLabels: Record<StatusFilter, string> = {
  all: '全部',
  submitted: '正常提交',
  supplementary: '补录',
  withdrawn: '已撤回',
  duplicate: '重复提交',
};

const submissionTypeConfig = {
  normal: { label: '正常', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  supplementary: { label: '补录', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  withdrawn: { label: '撤回', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  duplicate: { label: '重复', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
};

const statusConfig = {
  draft: { label: '草稿', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  submitted: { label: '已提交', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  withdrawn: { label: '已撤回', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  supplementary: { label: '补录', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  duplicate: { label: '重复', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
};

const severityConfig = {
  low: { label: '低', color: 'bg-green-500/20 text-green-400' },
  medium: { label: '中', color: 'bg-amber-500/20 text-amber-400' },
  high: { label: '高', color: 'bg-red-500/20 text-red-400' },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function Reports() {
  const [reports, setReports] = useState<DriftReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<ReportDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [duplicateCheckOpen, setDuplicateCheckOpen] = useState(false);
  const [currentReport, setCurrentReport] = useState<DriftReport | null>(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [duplicateResult, setDuplicateResult] = useState<{
    isDuplicate: boolean;
    duplicateOf?: DriftReport;
    report?: DriftReport;
  } | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.success) {
        setReports(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
      const matchesSearch = report.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [reports, statusFilter, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReports.map((r) => r.id)));
    }
  };

  const openPreview = async (report: DriftReport) => {
    try {
      setPreviewLoading(true);
      setPreviewOpen(true);
      const res = await fetch(`/api/reports/${report.id}`);
      const data = await res.json();
      if (data.success) {
        setPreviewData(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch report detail:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openWithdraw = (report: DriftReport) => {
    setCurrentReport(report);
    setReason('');
    setWithdrawOpen(true);
  };

  const openSupplement = (report: DriftReport) => {
    setCurrentReport(report);
    setReason('');
    setSupplementOpen(true);
  };

  const openDuplicateCheck = async (report: DriftReport) => {
    try {
      setCurrentReport(report);
      setDuplicateCheckOpen(true);
      setDuplicateResult(null);
      setActionLoading(true);
      const res = await fetch(`/api/reports/${report.id}/duplicate-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setDuplicateResult(data.data);
        if (data.data.isDuplicate) {
          await fetchReports();
        }
      }
    } catch (error) {
      console.error('Failed to check duplicate:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!currentReport || !reason.trim()) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/reports/${currentReport.id}/withdraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawOpen(false);
        setReason('');
        await fetchReports();
      }
    } catch (error) {
      console.error('Failed to withdraw:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSupplement = async () => {
    if (!currentReport || !reason.trim()) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/reports/${currentReport.id}/supplement`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        setSupplementOpen(false);
        setReason('');
        await fetchReports();
      }
    } catch (error) {
      console.error('Failed to supplement:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = (id: string) => {
    window.open(`/api/reports/${id}/export`, '_blank');
  };

  const handleExportSelected = () => {
    selectedIds.forEach((id) => handleExport(id));
  };

  const handleExportAll = () => {
    filteredReports.forEach((r) => handleExport(r.id));
  };

  const handleSubmit = async (report: DriftReport) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/reports/${report.id}/submit`, {
        method: 'PUT',
      });
      const data = await res.json();
      if (data.success) {
        await fetchReports();
      }
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex-shrink-0 px-6 py-4 border-b border-charcoal-700 bg-charcoal-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-display text-cyan-300">报告中心</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSelected}
              disabled={selectedIds.size === 0}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                selectedIds.size > 0
                  ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30'
                  : 'bg-charcoal-700 text-charcoal-500 cursor-not-allowed border border-charcoal-600'
              )}
            >
              <Download size={16} />
              导出选中项 ({selectedIds.size})
            </button>
            <button
              onClick={handleExportAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-charcoal-700 text-charcoal-200 hover:bg-charcoal-600 border border-charcoal-600 transition-all"
            >
              <Download size={16} />
              导出全部
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-charcoal-700/50 rounded-lg p-1">
            {(Object.keys(statusLabels) as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  statusFilter === status
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-700'
                )}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>

          <div className="flex-1 max-w-md relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400"
            />
            <input
              type="text"
              placeholder="按报告ID搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-charcoal-700/50 border border-charcoal-600 rounded-lg text-sm text-charcoal-100 placeholder-charcoal-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-charcoal-400">加载中...</div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-charcoal-400">
            <FileText size={48} className="mb-4 opacity-50" />
            <p>暂无报告数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-charcoal-800 z-10">
                <tr className="border-b border-charcoal-700">
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredReports.length && filteredReports.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-charcoal-600 bg-charcoal-700 text-cyan-500 focus:ring-cyan-500/30"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                    报告ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                    文件名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                    创建时间
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                    提交类型
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-700/50">
                {filteredReports.map((report) => {
                  const subTypeConfig = submissionTypeConfig[report.submissionType];
                  const statConfig = statusConfig[report.status];

                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-charcoal-700/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(report.id)}
                          onChange={() => toggleSelect(report.id)}
                          className="w-4 h-4 rounded border-charcoal-600 bg-charcoal-700 text-cyan-500 focus:ring-cyan-500/30"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-charcoal-200">
                          {report.id.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-charcoal-200">
                          analysis_{report.analysisId.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-charcoal-300">
                          {formatDate(report.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                            subTypeConfig.color
                          )}
                        >
                          {subTypeConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                            statConfig.color
                          )}
                        >
                          {statConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openPreview(report)}
                            title="预览"
                            className="p-1.5 rounded-lg text-charcoal-400 hover:text-cyan-300 hover:bg-cyan-500/20 transition-all"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleExport(report.id)}
                            title="导出"
                            className="p-1.5 rounded-lg text-charcoal-400 hover:text-cyan-300 hover:bg-cyan-500/20 transition-all"
                          >
                            <Download size={16} />
                          </button>
                          {report.status === 'submitted' && (
                            <button
                              onClick={() => openWithdraw(report)}
                              title="撤回"
                              className="p-1.5 rounded-lg text-charcoal-400 hover:text-red-400 hover:bg-red-500/20 transition-all"
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                          {report.status === 'draft' && (
                            <button
                              onClick={() => handleSubmit(report)}
                              title="提交"
                              className="p-1.5 rounded-lg text-charcoal-400 hover:text-green-400 hover:bg-green-500/20 transition-all"
                            >
                              <ArrowUpCircle size={16} />
                            </button>
                          )}
                          {(report.status === 'withdrawn' || report.status === 'draft') && (
                            <button
                              onClick={() => openSupplement(report)}
                              title="补录"
                              className="p-1.5 rounded-lg text-charcoal-400 hover:text-blue-400 hover:bg-blue-500/20 transition-all"
                            >
                              <PlusCircle size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => openDuplicateCheck(report)}
                            title="重复检测"
                            className="p-1.5 rounded-lg text-charcoal-400 hover:text-amber-400 hover:bg-amber-500/20 transition-all"
                          >
                            <AlertTriangle size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col w-full max-w-5xl max-h-[90vh] bg-charcoal-800 rounded-xl border border-charcoal-700 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-700">
              <h2 className="text-xl font-display text-cyan-300">报告详情</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => previewData && handleExport(previewData.report.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 transition-all"
                >
                  <Download size={14} />
                  导出 CSV
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-1.5 rounded-lg text-charcoal-400 hover:text-white hover:bg-charcoal-700 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {previewLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-charcoal-400">加载中...</div>
                </div>
              ) : previewData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-charcoal-700/50 rounded-lg p-4 border border-charcoal-600">
                      <div className="text-xs text-charcoal-400 mb-1">报告ID</div>
                      <div className="font-mono text-sm text-charcoal-200">
                        {previewData.report.id}
                      </div>
                    </div>
                    <div className="bg-charcoal-700/50 rounded-lg p-4 border border-charcoal-600">
                      <div className="text-xs text-charcoal-400 mb-1">状态</div>
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                          statusConfig[previewData.report.status].color
                        )}
                      >
                        {statusConfig[previewData.report.status].label}
                      </span>
                    </div>
                    <div className="bg-charcoal-700/50 rounded-lg p-4 border border-charcoal-600">
                      <div className="text-xs text-charcoal-400 mb-1">创建时间</div>
                      <div className="text-sm text-charcoal-200">
                        {formatDate(previewData.report.createdAt)}
                      </div>
                    </div>
                  </div>

                  {previewData.result && (
                    <div className="bg-charcoal-700/30 rounded-lg border border-charcoal-600 p-4">
                      <h3 className="text-sm font-medium text-charcoal-200 mb-4">漂移曲线</h3>
                      <DriftCurve
                        driftCurve={previewData.result.driftCurve}
                        threshold={50}
                        anomalyRegions={previewData.result.anomalyRegions}
                        height={250}
                      />
                    </div>
                  )}

                  {previewData.result && previewData.result.segments.length > 0 && (
                    <div className="bg-charcoal-700/30 rounded-lg border border-charcoal-600 p-4">
                      <h3 className="text-sm font-medium text-charcoal-200 mb-4">分段统计摘要</h3>
                      <div className="overflow-x-auto">
                        <SegmentStats segments={previewData.result.segments} threshold={50} />
                      </div>
                    </div>
                  )}

                  {previewData.result && previewData.result.anomalyRegions.length > 0 && (
                    <div className="bg-charcoal-700/30 rounded-lg border border-charcoal-600 p-4">
                      <h3 className="text-sm font-medium text-charcoal-200 mb-4">异常清单</h3>
                      <div className="grid gap-3">
                        {previewData.result.anomalyRegions.map((anomaly: AnomalyRegion) => {
                          const sevConfig = severityConfig[anomaly.severity];
                          return (
                            <div
                              key={anomaly.id}
                              className="flex items-center justify-between bg-charcoal-800 rounded-lg p-3 border border-charcoal-600"
                            >
                              <div className="flex items-center gap-3">
                                <AlertTriangle
                                  size={18}
                                  className={
                                    anomaly.severity === 'high'
                                      ? 'text-red-400'
                                      : anomaly.severity === 'medium'
                                      ? 'text-amber-400'
                                      : 'text-green-400'
                                  }
                                />
                                <div>
                                  <div className="text-sm text-charcoal-200">
                                    {anomaly.tag}
                                  </div>
                                  <div className="text-xs text-charcoal-400 font-mono">
                                    {formatTime(anomaly.startMs)} - {formatTime(anomaly.endMs)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span
                                  className={cn(
                                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                    sevConfig.color
                                  )}
                                >
                                  {sevConfig.label}
                                </span>
                                <div className="text-right">
                                  <div className="text-xs text-charcoal-400">漂移量</div>
                                  <div className="text-sm font-mono text-charcoal-200">
                                    {anomaly.driftAtStart.toFixed(1)}ms → {anomaly.driftAtEnd.toFixed(1)}ms
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {previewData.notes.length > 0 && (
                    <div className="bg-charcoal-700/30 rounded-lg border border-charcoal-600 p-4">
                      <h3 className="text-sm font-medium text-charcoal-200 mb-4">课堂备注</h3>
                      <div className="grid gap-3">
                        {previewData.notes.map((note: ClassNote) => (
                          <div
                            key={note.id}
                            className="bg-charcoal-800 rounded-lg p-3 border border-charcoal-600"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-charcoal-400 font-mono">
                                {formatTime(note.timeMsStart)} - {formatTime(note.timeMsEnd)}
                              </span>
                              <span
                                className={cn(
                                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                  note.type === 'correction'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : note.type === 'screenshot'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-cyan-500/20 text-cyan-400'
                                )}
                              >
                                {note.type === 'correction'
                                  ? '纠错'
                                  : note.type === 'screenshot'
                                  ? '截图'
                                  : '文本'}
                              </span>
                            </div>
                            <p className="text-sm text-charcoal-200">{note.content}</p>
                            {note.screenshotUrl && (
                              <img
                                src={note.screenshotUrl}
                                alt="Screenshot"
                                className="mt-2 rounded-lg border border-charcoal-600 max-h-40 object-contain"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewData.errors.length > 0 && (
                    <div className="bg-charcoal-700/30 rounded-lg border border-charcoal-600 p-4">
                      <h3 className="text-sm font-medium text-charcoal-200 mb-4">错因追踪</h3>
                      <div className="grid gap-3">
                        {previewData.errors.map((error: ErrorCause) => (
                          <div
                            key={error.id}
                            className="bg-charcoal-800 rounded-lg p-3 border border-charcoal-600"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-charcoal-400">
                                  {formatTime(error.timeMsStart)} - {formatTime(error.timeMsEnd)}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                                  {error.type}
                                </span>
                              </div>
                              <span className="text-xs text-charcoal-400">
                                影响: {error.impactScore.toFixed(1)}
                              </span>
                            </div>
                            <p className="text-sm text-charcoal-200 mb-2">{error.reason}</p>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-charcoal-400">
                                下一步: {error.nextAction === 'manual_correct' ? '手动修正' : error.nextAction === 'ignore' ? '忽略' : '重新检测'}
                              </span>
                              {error.resolvedAt && (
                                <span className="text-green-400 flex items-center gap-1">
                                  <Check size={12} />
                                  已解决
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-charcoal-800 rounded-xl border border-charcoal-700 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-700">
              <h2 className="text-lg font-medium text-charcoal-100">撤回报告</h2>
              <button
                onClick={() => setWithdrawOpen(false)}
                className="p-1.5 rounded-lg text-charcoal-400 hover:text-white hover:bg-charcoal-700 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-charcoal-200 mb-2">
                  撤回原因 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请输入撤回原因..."
                  rows={4}
                  className="w-full px-4 py-2 bg-charcoal-700/50 border border-charcoal-600 rounded-lg text-sm text-charcoal-100 placeholder-charcoal-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setWithdrawOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-charcoal-700 text-charcoal-200 hover:bg-charcoal-600 border border-charcoal-600 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={!reason.trim() || actionLoading}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                    reason.trim() && !actionLoading
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                      : 'bg-charcoal-700 text-charcoal-500 cursor-not-allowed border border-charcoal-600'
                  )}
                >
                  {actionLoading ? '处理中...' : '确认撤回'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {supplementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-charcoal-800 rounded-xl border border-charcoal-700 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-700">
              <h2 className="text-lg font-medium text-charcoal-100">补录报告</h2>
              <button
                onClick={() => setSupplementOpen(false)}
                className="p-1.5 rounded-lg text-charcoal-400 hover:text-white hover:bg-charcoal-700 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-charcoal-200 mb-2">
                  补录原因 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请输入补录原因..."
                  rows={4}
                  className="w-full px-4 py-2 bg-charcoal-700/50 border border-charcoal-600 rounded-lg text-sm text-charcoal-100 placeholder-charcoal-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSupplementOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-charcoal-700 text-charcoal-200 hover:bg-charcoal-600 border border-charcoal-600 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSupplement}
                  disabled={!reason.trim() || actionLoading}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                    reason.trim() && !actionLoading
                      ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30'
                      : 'bg-charcoal-700 text-charcoal-500 cursor-not-allowed border border-charcoal-600'
                  )}
                >
                  {actionLoading ? '处理中...' : '确认补录'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {duplicateCheckOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-charcoal-800 rounded-xl border border-charcoal-700 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-700">
              <h2 className="text-lg font-medium text-charcoal-100">重复检测结果</h2>
              <button
                onClick={() => {
                  setDuplicateCheckOpen(false);
                  setDuplicateResult(null);
                }}
                className="p-1.5 rounded-lg text-charcoal-400 hover:text-white hover:bg-charcoal-700 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {actionLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-charcoal-400">检测中...</div>
                </div>
              ) : duplicateResult ? (
                <div>
                  {duplicateResult.isDuplicate && duplicateResult.duplicateOf ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <AlertTriangle size={24} className="text-amber-400 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-amber-400">检测到重复报告</div>
                          <div className="text-sm text-charcoal-300 mt-1">
                            当前报告与以下报告可能重复，请选择处理方式
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-charcoal-700/50 rounded-lg p-4 border border-charcoal-600">
                          <div className="text-xs text-charcoal-400 mb-2">当前报告</div>
                          <div className="font-mono text-sm text-charcoal-200 mb-1">
                            {currentReport?.id.slice(0, 12)}...
                          </div>
                          <div className="text-xs text-charcoal-400">
                            {formatDate(currentReport?.createdAt || '')}
                          </div>
                          <div className="mt-2">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                                statusConfig[currentReport?.status || 'draft'].color
                              )}
                            >
                              {statusConfig[currentReport?.status || 'draft'].label}
                            </span>
                          </div>
                        </div>

                        <div className="bg-charcoal-700/50 rounded-lg p-4 border border-amber-500/30">
                          <div className="text-xs text-amber-400 mb-2">可能重复的报告</div>
                          <div className="font-mono text-sm text-charcoal-200 mb-1">
                            {duplicateResult.duplicateOf.id.slice(0, 12)}...
                          </div>
                          <div className="text-xs text-charcoal-400">
                            {formatDate(duplicateResult.duplicateOf.createdAt)}
                          </div>
                          <div className="mt-2">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                                statusConfig[duplicateResult.duplicateOf.status].color
                              )}
                            >
                              {statusConfig[duplicateResult.duplicateOf.status].label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <button
                          onClick={() => {
                            setDuplicateCheckOpen(false);
                            setDuplicateResult(null);
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-charcoal-700 text-charcoal-200 hover:bg-charcoal-600 border border-charcoal-600 transition-all"
                        >
                          关闭
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Check size={32} className="text-green-400" />
                      </div>
                      <div className="text-lg font-medium text-green-400 mb-1">未检测到重复</div>
                      <div className="text-sm text-charcoal-400">
                        当前报告没有发现重复项
                      </div>
                      <button
                        onClick={() => {
                          setDuplicateCheckOpen(false);
                          setDuplicateResult(null);
                        }}
                        className="mt-6 px-4 py-2 rounded-lg text-sm font-medium bg-charcoal-700 text-charcoal-200 hover:bg-charcoal-600 border border-charcoal-600 transition-all"
                      >
                        关闭
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

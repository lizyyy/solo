import { useState, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  File,
  CheckCircle,
  ChevronDown,
  RefreshCw,
  Copy,
  Check,
  Plus,
  Edit3,
  Minus,
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ChangeTypeBadge } from '@/components/StatusBadge';
import { useAppStore, fetchDashboardStats, fetchImportBatches, exportReport } from '@/store';
import type { ImportBatch } from '@/../shared/types';
import { cn } from '@/lib/utils';

const formatOptions = [
  { value: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet, color: 'text-emerald-green-400' },
  { value: 'csv', label: 'CSV (.csv)', icon: FileText, color: 'text-amber-yellow-400' },
  { value: 'pdf', label: 'PDF (.pdf)', icon: File, color: 'text-coral-red-400' },
];

export default function ExportPage() {
  const { dashboardStats, loading, importBatches } = useAppStore();
  const [selectedFormat, setSelectedFormat] = useState<'xlsx' | 'csv' | 'pdf'>('xlsx');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportedReport, setExportedReport] = useState<any>(null);

  useEffect(() => {
    fetchDashboardStats();
    fetchImportBatches();
  }, []);

  const toggleBatch = (batchId: string) => {
    setSelectedBatches(prev =>
      prev.includes(batchId)
        ? prev.filter(id => id !== batchId)
        : [...prev, batchId]
    );
  };

  const handleExport = async () => {
    const result = await exportReport(selectedFormat, selectedBatches.length > 0 ? selectedBatches : undefined);
    if (result) {
      setExportedReport(result.report);
    }
  };

  const copyChangeList = () => {
    if (!exportedReport) return;
    const text = exportedReport.changes.map((c: any) =>
      `[${c.changeType === 'new' ? '新增' : c.changeType === 'updated' ? '更新' : '无变化'}] ${c.trackId}`
    ).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const changeGroups = exportedReport ? [
    { key: 'new', label: '新增曲目', icon: Plus, data: exportedReport.changes.filter((c: any) => c.changeType === 'new') },
    { key: 'updated', label: '更新曲目', icon: Edit3, data: exportedReport.changes.filter((c: any) => c.changeType === 'updated') },
    { key: 'unchanged', label: '无变化', icon: Minus, data: exportedReport.changes.filter((c: any) => c.changeType === 'unchanged') },
  ] : [];

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-3xl font-bold text-white mb-2">结果导出</h1>
        <p className="text-deep-blue-300">生成复核报告，下载完整数据</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 animate-stagger">
            <h2 className="font-display font-semibold text-white text-lg mb-6">导出配置</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm text-deep-blue-300 mb-3">导出格式</label>
                <div className="grid grid-cols-3 gap-3">
                  {formatOptions.map(format => {
                    const Icon = format.icon;
                    const isSelected = selectedFormat === format.value;
                    return (
                      <button
                        key={format.value}
                        onClick={() => setSelectedFormat(format.value as any)}
                        className={cn(
                          'p-4 rounded-lg border text-left transition-all duration-200',
                          isSelected
                            ? 'bg-neon-purple-500/10 border-neon-purple-500/40'
                            : 'bg-deep-blue-600/30 border-deep-blue-400/10 hover:border-deep-blue-400/30'
                        )}
                      >
                        <Icon className={cn('w-6 h-6 mb-2', format.color)} />
                        <p className="font-medium text-white text-sm">{format.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm text-deep-blue-300 mb-3">导入批次（可选，留空导出全部）</label>
                <div className="relative">
                  <button
                    onClick={() => setBatchDropdownOpen(!batchDropdownOpen)}
                    className="input-field w-full flex items-center justify-between"
                  >
                    <span className="text-deep-blue-300">
                      {selectedBatches.length === 0
                        ? '全部批次'
                        : `已选择 ${selectedBatches.length} 个批次`}
                    </span>
                    <ChevronDown className={cn(
                      'w-4 h-4 transition-transform duration-200',
                      batchDropdownOpen && 'rotate-180'
                    )} />
                  </button>

                  {batchDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-deep-blue-700 border border-deep-blue-400/20 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center gap-3 p-2 hover:bg-deep-blue-600/50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBatches.length === 0}
                            onChange={() => setSelectedBatches([])}
                            className="w-4 h-4 rounded border-deep-blue-400 bg-deep-blue-600 text-neon-purple-500"
                          />
                          <span className="text-white text-sm">全部批次</span>
                        </label>
                        <div className="h-px bg-deep-blue-400/20 my-1" />
                        {importBatches.map((batch: ImportBatch) => (
                          <label
                            key={batch.id}
                            className="flex items-center gap-3 p-2 hover:bg-deep-blue-600/50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedBatches.includes(batch.id)}
                              onChange={() => toggleBatch(batch.id)}
                              className="w-4 h-4 rounded border-deep-blue-400 bg-deep-blue-600 text-neon-purple-500"
                            />
                            <div className="flex-1">
                              <p className="text-white text-sm">{batch.fileName}</p>
                              <p className="text-xs text-deep-blue-400">
                                {batch.id} · {new Date(batch.importedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="text-xs text-deep-blue-400">{batch.totalCount}条</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {dashboardStats && (
                <div className="p-4 bg-deep-blue-600/30 rounded-lg">
                  <h4 className="font-medium text-white mb-3">导出内容预览</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-deep-blue-400">总曲目数</p>
                      <p className="text-white font-semibold text-lg">{dashboardStats.totalTracks}</p>
                    </div>
                    <div>
                      <p className="text-deep-blue-400">有冲突</p>
                      <p className="text-coral-red-400 font-semibold text-lg">{dashboardStats.conflictCount}</p>
                    </div>
                    <div>
                      <p className="text-deep-blue-400">已解决</p>
                      <p className="text-emerald-green-400 font-semibold text-lg">{dashboardStats.resolvedCount}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleExport}
                disabled={loading.export}
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.export ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                生成并下载报告
              </button>
            </div>
          </div>

          {exportedReport && (
            <div className="card p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-green-400" />
                  变更清单
                </h2>
                <button
                  onClick={copyChangeList}
                  className="flex items-center gap-2 text-sm text-neon-purple-400 hover:text-neon-purple-300 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? '已复制' : '复制清单'}
                </button>
              </div>

              <div className="space-y-4">
                {changeGroups.map(group => (
                  <div key={group.key} className="p-4 bg-deep-blue-600/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        group.key === 'new' ? 'bg-emerald-green-500/20' :
                        group.key === 'updated' ? 'bg-neon-purple-500/20' : 'bg-deep-blue-500/20'
                      )}>
                        <group.icon className={cn(
                          'w-4 h-4',
                          group.key === 'new' ? 'text-emerald-green-400' :
                          group.key === 'updated' ? 'text-neon-purple-400' : 'text-deep-blue-400'
                        )} />
                      </div>
                      <h3 className="font-medium text-white">{group.label}</h3>
                      <span className="text-deep-blue-400 text-sm">{group.data.length} 条</span>
                    </div>

                    {group.data.length === 0 ? (
                      <p className="text-deep-blue-500 text-sm text-center py-4">暂无数据</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {group.data.map((item: any) => (
                          <div
                            key={item.trackId}
                            className="flex items-center justify-between p-3 bg-deep-blue-700/30 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <ChangeTypeBadge changeType={item.changeType} />
                              <span className="text-white text-sm">{item.trackId}</span>
                            </div>
                            {Object.keys(item.changes).length > 0 && (
                              <button
                                className="text-xs text-deep-blue-400 hover:text-neon-purple-400"
                                onClick={() => {
                                  const el = document.getElementById(`changes-${item.trackId}`);
                                  el?.classList.toggle('hidden');
                                }}
                              >
                                查看变更
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="divider" />

              <div className="p-4 bg-neon-purple-500/10 border border-neon-purple-500/20 rounded-lg">
                <h3 className="font-medium text-neon-purple-300 mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  复核结论摘要
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-deep-blue-400">总曲目数</p>
                    <p className="text-white font-semibold">{exportedReport.summary.totalTracks}</p>
                  </div>
                  <div>
                    <p className="text-deep-blue-400">有冲突曲目</p>
                    <p className="text-coral-red-400 font-semibold">{exportedReport.summary.conflictTracks}</p>
                  </div>
                  <div>
                    <p className="text-deep-blue-400">已解决冲突</p>
                    <p className="text-emerald-green-400 font-semibold">{exportedReport.summary.resolvedConflicts}</p>
                  </div>
                  <div>
                    <p className="text-deep-blue-400">未解决冲突</p>
                    <p className="text-amber-yellow-400 font-semibold">{exportedReport.summary.unresolvedConflicts}</p>
                  </div>
                  <div>
                    <p className="text-deep-blue-400">版权下架</p>
                    <p className="text-deep-blue-300 font-semibold">{exportedReport.summary.copyrightRemoved}</p>
                  </div>
                  <div>
                    <p className="text-deep-blue-400">人工修正</p>
                    <p className="text-neon-purple-400 font-semibold">{exportedReport.summary.manualCorrections}</p>
                  </div>
                </div>
                <p className="text-xs text-deep-blue-400 mt-4">
                  报告生成时间: {new Date(exportedReport.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6 animate-stagger" style={{ animationDelay: '100ms' }}>
            <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-neon-purple-400" />
              历史导入批次
            </h2>
            <div className="space-y-3">
              {importBatches.map((batch: ImportBatch) => (
                <div
                  key={batch.id}
                  className="p-4 bg-deep-blue-600/30 rounded-lg border border-deep-blue-400/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileSpreadsheet className="w-4 h-4 text-neon-purple-400" />
                    <span className="font-medium text-white text-sm truncate">{batch.fileName}</span>
                  </div>
                  <div className="text-xs text-deep-blue-400 space-y-1">
                    <p>{batch.id} · {new Date(batch.importedAt).toLocaleDateString()}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-green-400">新{batch.newCount}</span>
                      <span className="text-neon-purple-400">更{batch.updatedCount}</span>
                      <span className="text-deep-blue-400">无{batch.unchangedCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6 animate-stagger" style={{ animationDelay: '200ms' }}>
            <h2 className="font-display font-semibold text-white text-lg mb-4">导出说明</h2>
            <ul className="space-y-3 text-sm text-deep-blue-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-green-400 mt-0.5 flex-shrink-0" />
                <span>Excel格式包含摘要、曲目列表、冲突列表、变更清单4个工作表</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-green-400 mt-0.5 flex-shrink-0" />
                <span>变更清单清晰区分新增、更新、无变化的曲目</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-green-400 mt-0.5 flex-shrink-0" />
                <span>所有人工标注作为补充证据一并导出，支持复盘追溯</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-green-400 mt-0.5 flex-shrink-0" />
                <span>可选择特定批次导出，便于分批处理</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

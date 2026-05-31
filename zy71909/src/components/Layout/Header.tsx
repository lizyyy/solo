import { Music, Download, FileText, Settings, Filter, Plus } from 'lucide-react';
import { useAppStore, useSelectedBatch } from '../../store/useAppStore';
import { getCategoryStats } from '../../utils/calculations';
import { exportToPDF, generateReportText, downloadTextReport } from '../../utils/export';
import { getCategoryLabel } from '../../utils/classification';

export function Header() {
  const { 
    batches, 
    deviations, 
    students, 
    voiceParts, 
    notes,
    selectedBatchId, 
    setSelectedBatchId,
    setSidebarOpen,
    setEntryPanelOpen,
    filters,
    setFilters,
  } = useAppStore();
  
  const selectedBatch = useSelectedBatch();
  const stats = selectedBatchId ? getCategoryStats(deviations, selectedBatchId) : null;

  const handleExportPDF = async () => {
    if (!selectedBatch || !stats) return;
    await exportToPDF('report-content', selectedBatch, stats);
  };

  const handleExportText = () => {
    if (!selectedBatch) return;
    const report = generateReportText(selectedBatch, deviations, students, voiceParts, notes);
    downloadTextReport(report);
  };

  const sortedBatches = [...batches].sort((a, b) => 
    b.rehearsalDate.localeCompare(a.rehearsalDate)
  );

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-cream-300 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-600 rounded-lg flex items-center justify-center shadow-md">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold text-primary">音准趋势小报</h1>
              <p className="text-xs text-primary-500">合唱排练音高偏差分析系统</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedBatchId || ''}
              onChange={(e) => setSelectedBatchId(e.target.value || null)}
              className="px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            >
              <option value="">选择排练批次</option>
              {sortedBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.rehearsalDate} - {batch.title}
                </option>
              ))}
            </select>

            <select
              value={filters.voicePartId || ''}
              onChange={(e) => setFilters({ voicePartId: e.target.value || null })}
              className="px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            >
              <option value="">全部声部</option>
              {voiceParts.map((vp) => (
                <option key={vp.id} value={vp.id}>{vp.displayName}</option>
              ))}
            </select>

            <select
              value={filters.category || ''}
              onChange={(e) => setFilters({ category: (e.target.value as any) || null })}
              className="px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            >
              <option value="">全部分类</option>
              <option value="persistent">{getCategoryLabel('persistent')}</option>
              <option value="occasional">{getCategoryLabel('occasional')}</option>
              <option value="unreviewed">{getCategoryLabel('unreviewed')}</option>
              <option value="normal">{getCategoryLabel('normal')}</option>
            </select>

            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm text-primary cursor-pointer hover:bg-cream-50 transition-colors">
              <input
                type="checkbox"
                checked={filters.showAnomaliesOnly}
                onChange={(e) => setFilters({ showAnomaliesOnly: e.target.checked })}
                className="rounded text-accent focus:ring-accent"
              />
              <Filter className="w-4 h-4" />
              <span>仅异常</span>
            </label>

            <div className="h-6 w-px bg-cream-300 mx-1" />

            <button
              onClick={() => setEntryPanelOpen(true)}
              className="btn-ghost flex items-center gap-1.5"
              title="录入数据"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">录入</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="btn-secondary flex items-center gap-1.5"
              title="导出PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">导出PDF</span>
            </button>

            <button
              onClick={handleExportText}
              className="btn-ghost flex items-center gap-1.5"
              title="导出文本报告"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">文本</span>
            </button>

            <button
              onClick={() => setSidebarOpen(true)}
              className="btn-ghost"
              title="批次管理"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {selectedBatch && (
          <div className="mt-3 pt-3 border-t border-cream-200 flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <span className="text-primary-600">
                <span className="font-medium">曲目：</span>{selectedBatch.songName}
              </span>
              <span className="text-primary-600">
                <span className="font-medium">调性：</span>{selectedBatch.keySignature}
                {selectedBatch.keyChanged && (
                  <span className="ml-1 text-xs bg-accent/20 text-accent-700 px-1.5 py-0.5 rounded">
                    转调自 {selectedBatch.previousKey}
                  </span>
                )}
              </span>
              <span className="text-primary-600">
                <span className="font-medium">录音：</span>{selectedBatch.recordingFileName || '无'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                selectedBatch.status === 'final' ? 'bg-green-100 text-green-700' :
                selectedBatch.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {selectedBatch.status === 'final' ? '已定稿' :
                 selectedBatch.status === 'reviewed' ? '已复核' : '草稿'}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

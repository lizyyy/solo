import { useEffect, useState } from 'react';
import {
  FileJson,
  FileSpreadsheet,
  FileText,
  Download,
  History,
  Hash,
  Filter,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  exportToJSON,
  exportToExcel,
  exportToPDF,
  downloadBlob,
  generateExportFilename,
  generateExportMetadata
} from '@/utils/export';
import {
  formatDateTimeForDisplay,
  formatDateForDisplay,
  getStatusLabel,
  generateDataHash
} from '@/utils/helpers';
import type { FilterCriteria } from '@/types';

export default function Export() {
  const {
    requirements,
    filterSnapshots,
    exportHistory,
    currentFilters,
    getFilteredRequirements,
    isLoaded,
    initializeStore,
    addExportRecord,
    applyFilterSnapshot
  } = useAppStore();

  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'json' | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      initializeStore();
    }
  }, [isLoaded, initializeStore]);

  const filteredRequirements = getFilteredRequirements();
  const metadata = generateExportMetadata(currentFilters, filteredRequirements.length);

  const handleExport = async (format: 'pdf' | 'excel' | 'json') => {
    setExporting(format);
    try {
      let result;
      switch (format) {
        case 'json':
          result = await exportToJSON(filteredRequirements, currentFilters);
          break;
        case 'excel':
          result = await exportToExcel(filteredRequirements, currentFilters);
          break;
        case 'pdf':
          result = await exportToPDF(filteredRequirements, currentFilters);
          break;
      }

      const filename = generateExportFilename(format, currentFilters);
      downloadBlob(result.blob, filename);
      addExportRecord(result.record);

      setShowSuccess(format);
      setTimeout(() => setShowSuccess(null), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const describeFilters = (filters: FilterCriteria): string => {
    const parts: string[] = [];
    if (filters.bandName) parts.push(`乐队: ${filters.bandName}`);
    if (filters.status?.length) parts.push(`状态: ${filters.status.map(getStatusLabel).join(',')}`);
    if (filters.dateFrom) parts.push(`从: ${formatDateForDisplay(filters.dateFrom)}`);
    if (filters.dateTo) parts.push(`到: ${formatDateForDisplay(filters.dateTo)}`);
    if (filters.hasConflict !== undefined) parts.push(filters.hasConflict ? '仅冲突' : '无冲突');
    return parts.length > 0 ? parts.join(' · ') : '全部数据';
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neon-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono text-base-500">正在加载数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold uppercase tracking-wider flex items-center gap-3">
          <Download className="w-6 h-6 text-neon-green" />
          报告导出
        </h1>
        <p className="text-sm font-mono text-base-500 mt-1">
          导出数据包含完整计算参数，使用相同筛选条件可复现
        </p>
      </div>

      {showSuccess && (
        <div className="panel border-2 border-neon-green bg-neon-green bg-opacity-5">
          <div className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-neon-green" />
            <span className="font-mono text-neon-green">
              {showSuccess.toUpperCase()} 报告导出成功，记录已保存到历史
            </span>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <Filter className="w-4 h-4 text-neon-cyan" />
          当前筛选参数快照
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-mono text-base-500 mb-1">筛选描述</div>
              <div className="font-mono text-sm">{describeFilters(currentFilters)}</div>
            </div>
            <div>
              <div className="text-xs font-mono text-base-500 mb-1">匹配记录数</div>
              <div className="font-mono text-2xl font-bold text-neon-cyan">
                {filteredRequirements.length} / {requirements.length}
              </div>
            </div>
          </div>

          <div className="p-3 bg-base-900 border border-base-700 font-mono text-xs">
            <div className="text-base-500 mb-2">完整 JSON 参数（可用于复现）:</div>
            <pre className="text-neon-purple overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(currentFilters, null, 2)}
            </pre>
          </div>

          <div className="flex items-center gap-3 p-3 bg-base-900 border border-neon-orange">
            <Hash className="w-4 h-4 text-neon-orange flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-base-500">数据哈希校验</div>
              <div className="font-mono text-neon-orange text-sm">{metadata.dataHash}</div>
            </div>
            <button
              onClick={() => copyToClipboard(metadata.dataHash, 'current-hash')}
              className="btn btn-secondary text-xs"
            >
              {copiedHash === 'current-hash' ? (
                <Check className="w-3 h-3 text-neon-green" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">导出格式</div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="panel hover:border-neon-pink transition-colors group disabled:opacity-50"
          >
            <div className="p-4 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3 text-neon-pink group-hover:scale-110 transition-transform" />
              <div className="font-mono font-bold mb-1">PDF 报告</div>
              <div className="text-xs font-mono text-base-500 mb-3">
                适用于打印和存档，包含筛选参数和数据哈希
              </div>
              {exporting === 'pdf' ? (
                <div className="w-6 h-6 border-2 border-neon-pink border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                <span className="btn btn-primary text-xs">导出 PDF</span>
              )}
            </div>
          </button>

          <button
            onClick={() => handleExport('excel')}
            disabled={exporting !== null}
            className="panel hover:border-neon-green transition-colors group disabled:opacity-50"
          >
            <div className="p-4 text-center">
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-neon-green group-hover:scale-110 transition-transform" />
              <div className="font-mono font-bold mb-1">Excel 表格</div>
              <div className="text-xs font-mono text-base-500 mb-3">
                包含需求清单、通道明细、冲突列表、导出参数四个工作表
              </div>
              {exporting === 'excel' ? (
                <div className="w-6 h-6 border-2 border-neon-green border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                <span className="btn btn-primary text-xs">导出 Excel</span>
              )}
            </div>
          </button>

          <button
            onClick={() => handleExport('json')}
            disabled={exporting !== null}
            className="panel hover:border-neon-cyan transition-colors group disabled:opacity-50"
          >
            <div className="p-4 text-center">
              <FileJson className="w-10 h-10 mx-auto mb-3 text-neon-cyan group-hover:scale-110 transition-transform" />
              <div className="font-mono font-bold mb-1">JSON 数据</div>
              <div className="text-xs font-mono text-base-500 mb-3">
                完整原始数据，适合程序处理和数据迁移
              </div>
              {exporting === 'json' ? (
                <div className="w-6 h-6 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                <span className="btn btn-primary text-xs">导出 JSON</span>
              )}
            </div>
          </button>
        </div>
      </div>

      {filterSnapshots.length > 0 && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <Filter className="w-4 h-4 text-neon-purple" />
            已保存的筛选快照 ({filterSnapshots.length})
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">快照名称</th>
                    <th className="table-header">筛选条件</th>
                    <th className="table-header">保存时间</th>
                    <th className="table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filterSnapshots.map((snapshot) => (
                    <tr key={snapshot.id} className="hover:bg-base-800 transition-colors">
                      <td className="table-cell font-mono font-medium">{snapshot.name}</td>
                      <td className="table-cell font-mono text-sm">
                        {describeFilters(snapshot.filters)}
                      </td>
                      <td className="table-cell font-mono text-xs text-base-500">
                        {formatDateTimeForDisplay(snapshot.createdAt)}
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => applyFilterSnapshot(snapshot.id)}
                          className="btn btn-secondary text-xs"
                        >
                          应用
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <History className="w-4 h-4 text-neon-orange" />
          导出历史记录 ({exportHistory.length})
        </div>
        <div className="p-4">
          {exportHistory.length === 0 ? (
            <div className="text-center py-8 text-base-500 font-mono">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              暂无导出记录
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">格式</th>
                    <th className="table-header">记录数</th>
                    <th className="table-header">筛选条件</th>
                    <th className="table-header">数据哈希</th>
                    <th className="table-header">导出时间</th>
                    <th className="table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {exportHistory.slice().reverse().map((record) => (
                    <tr key={record.id} className="hover:bg-base-800 transition-colors">
                      <td className="table-cell">
                        <span
                          className={`px-2 py-1 text-xs font-mono border ${
                            record.format === 'pdf'
                              ? 'border-neon-pink text-neon-pink'
                              : record.format === 'excel'
                              ? 'border-neon-green text-neon-green'
                              : 'border-neon-cyan text-neon-cyan'
                          }`}
                        >
                          {record.format.toUpperCase()}
                        </span>
                      </td>
                      <td className="table-cell font-mono">{record.recordCount}</td>
                      <td className="table-cell font-mono text-xs">
                        {describeFilters(record.filterCriteria)}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs text-neon-orange">
                            {record.fileHash.substring(0, 8)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(record.fileHash, record.id)}
                            className="text-base-500 hover:text-neon-orange"
                            title="复制完整哈希"
                          >
                            {copiedHash === record.id ? (
                              <Check className="w-3 h-3 text-neon-green" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="table-cell font-mono text-xs text-base-500">
                        {formatDateTimeForDisplay(record.createdAt)}
                      </td>
                      <td className="table-cell">
                        {record.snapshotId && (
                          <button
                            onClick={() => applyFilterSnapshot(record.snapshotId!)}
                            className="btn btn-secondary text-xs"
                          >
                            复现
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <Hash className="w-4 h-4 text-neon-purple" />
          复现说明
        </div>
        <div className="p-4 space-y-3 text-sm font-mono text-base-400">
          <p>1. 每份导出报告都包含完整的筛选参数快照和数据哈希</p>
          <p>2. 在"已保存的筛选快照"中点击"应用"可恢复当时的筛选条件</p>
          <p>3. 使用相同筛选条件和系统版本 v{metadata.exportVersion} 可复现相同数据</p>
          <p>4. 对比导出报告中的数据哈希值 {metadata.dataHash} 可验证数据一致性</p>
          <p>5. 所有导出操作都会记录到历史，便于审计和追溯</p>
        </div>
      </div>
    </div>
  );
}

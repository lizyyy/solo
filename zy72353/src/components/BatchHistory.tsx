import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  FileText,
  Upload,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
} from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';
import { cn } from '../lib/utils';
import type { ImportBatch } from '../types';

interface BatchHistoryProps {
  onSelectThresholdId?: (id: string) => void;
}

const sourceLabel: Record<string, string> = {
  file: '文件导入',
  sample: '采样数据',
  manual: '手工录入',
};

const formatLabel: Record<string, string> = {
  csv: 'CSV',
  json: 'JSON',
  xlsx: 'Excel',
  unknown: '未知格式',
};

const BatchHistory = ({ onSelectThresholdId }: BatchHistoryProps) => {
  const navigate = useNavigate();
  const { batches, getThresholdsByBatchId, exportBatch, currentRole } = useThresholdStore();
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const handleSelectThreshold = (id: string) => {
    if (onSelectThresholdId) {
      onSelectThresholdId(id);
    } else {
      navigate(`/threshold/${id}`);
    }
  };

  const BatchCard = ({ batch }: { batch: ImportBatch }) => {
    const thresholds = getThresholdsByBatchId(batch.id);
    const isExpanded = expandedBatch === batch.id;

    return (
      <div className="bg-industrial-600 rounded-xl border border-industrial-500 overflow-hidden">
        <div
          className="p-5 cursor-pointer hover:bg-industrial-700/30 transition-colors"
          onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedBatch(isExpanded ? null : batch.id);
                }}
                className="text-industrial-400 hover:text-white mt-1"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>
              <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-semibold font-mono text-lg">{batch.batchNo}</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-industrial-700 text-industrial-300">
                    {batch.source === 'file' ? (
                      <FileText className="w-3 h-3" />
                    ) : batch.source === 'sample' ? (
                      <Upload className="w-3 h-3" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                    {sourceLabel[batch.source] || batch.source}
                  </span>
                  {batch.format && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-industrial-700 text-industrial-300">
                      {formatLabel[batch.format] || batch.format}
                    </span>
                  )}
                </div>
                {batch.fileName && (
                  <p className="text-industrial-400 text-sm mb-2">📄 {batch.fileName}</p>
                )}
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-industrial-400">
                    <User className="w-3.5 h-3.5" />
                    <span>{batch.importedBy}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-industrial-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(batch.importedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2 mb-1">
                  {batch.successCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-success-500/20 text-success-400 border border-success-500/30">
                      <CheckCircle className="w-3 h-3" />
                      {batch.successCount} 成功
                    </span>
                  )}
                  {batch.duplicateCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-warning-500/20 text-warning-400 border border-warning-500/30">
                      <AlertTriangle className="w-3 h-3" />
                      {batch.duplicateCount} 重复
                    </span>
                  )}
                  {batch.errorCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30">
                      <XCircle className="w-3 h-3" />
                      {batch.errorCount} 错误
                    </span>
                  )}
                </div>
                <p className="text-industrial-400 text-xs">
                  共 {batch.totalCount} 条，含 {thresholds.length} 条阈值
                </p>
              </div>
              {currentRole === 'coach' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportBatch(batch.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-industrial-700 hover:bg-industrial-500 text-white rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  导出批次
                </button>
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-industrial-500 p-5 bg-industrial-700/20">
            {batch.messages && batch.messages.length > 0 && (
              <div className="mb-4">
                <p className="text-industrial-300 text-xs mb-2 font-medium">导入日志</p>
                <div className="bg-industrial-700/50 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
                  {batch.messages.map((msg, i) => (
                    <p
                      key={i}
                      className={cn(
                        'text-xs font-mono',
                        msg.includes('错误') || msg.includes('缺少')
                          ? 'text-red-400'
                          : msg.includes('跳过') || msg.includes('重复')
                          ? 'text-warning-400'
                          : 'text-industrial-300'
                      )}
                    >
                      {msg}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-industrial-300 text-xs mb-2 font-medium">
                本批次阈值（{thresholds.length}）
              </p>
              <div className="grid grid-cols-2 gap-2">
                {thresholds.map((th) => (
                  <button
                    key={th.id}
                    onClick={() => handleSelectThreshold(th.id)}
                    className="text-left p-3 bg-industrial-700 hover:bg-industrial-500 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white text-sm font-medium truncate group-hover:text-primary-400 transition-colors">
                        {th.name}
                      </p>
                      {th.hasUnitMix && (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning-400 flex-shrink-0 ml-2" />
                      )}
                    </div>
                    <p className="text-industrial-400 text-xs font-mono">
                      {th.value}
                      {th.unit === 'Celsius' ? '℃' : 'K'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {batches.length === 0 ? (
        <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-16 text-center">
          <Package className="w-16 h-16 text-industrial-400 mx-auto mb-4" />
          <p className="text-industrial-300 text-lg">暂无导入批次记录</p>
          <p className="text-industrial-400 mt-1">可从「阈值列表」页的导入按钮开始</p>
        </div>
      ) : (
        batches.map((batch) => <BatchCard key={batch.id} batch={batch} />)
      )}
    </div>
  );
};

export default BatchHistory;

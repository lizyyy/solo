import { useState, useMemo } from 'react';
import {
  AlertCircle,
  Table,
  Camera,
  Image,
  FileText,
  PenTool,
  ChevronDown,
  ChevronUp,
  X,
  Filter,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { ImportErrorLog, SourceType, ErrorType, ErrorStatus } from '@/types';
import { cn } from '@/lib/utils';

const sourceTypeIcons: Record<SourceType, React.ElementType> = {
  point_table: Table,
  photo: Camera,
  meeting_screenshot: Image,
  plan_note: FileText,
  manual_coordinate: PenTool,
};

const sourceTypeLabels: Record<SourceType, string> = {
  point_table: '点位表',
  photo: '照片',
  meeting_screenshot: '周会截图',
  plan_note: '方案备注',
  manual_coordinate: '手改坐标',
};

const errorTypeColors: Record<ErrorType, string> = {
  data_corrupted: 'bg-red-500/15 text-red-400 border-red-500/30',
  format_invalid: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  missing_required: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  out_of_range: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  coordinate_mismatch: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const errorTypeLabels: Record<ErrorType, string> = {
  data_corrupted: '数据损坏',
  format_invalid: '格式无效',
  missing_required: '缺少必填',
  out_of_range: '超出范围',
  coordinate_mismatch: '坐标不匹配',
};

const statusColors: Record<ErrorStatus, string> = {
  pending: 'bg-red-500/15 text-red-400 border-red-500/30',
  fixed: 'bg-green-500/15 text-green-400 border-green-500/30',
  ignored: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const statusLabels: Record<ErrorStatus, string> = {
  pending: '待处理',
  fixed: '已修复',
  ignored: '已忽略',
};

function ErrorItem({ error }: { error: ImportErrorLog }) {
  const { resolveImportError } = useStore();
  const SourceIcon = sourceTypeIcons[error.sourceType] ?? AlertCircle;

  const handleResolve = async (status: ErrorStatus) => {
    await resolveImportError(error.id, {
      status,
      resolution: status === 'fixed' ? '已修复' : '已忽略',
      resolvedBy: 'system',
    });
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-gray-900/50 border border-white/5 hover:border-red-500/20 transition-colors">
      <div className="mt-0.5">
        <SourceIcon className="w-5 h-5 text-red-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-medium text-gray-200 truncate">
            {error.sourceName}
          </span>
          {error.sourceRef && (
            <span className="text-xs text-gray-500 font-mono">
              · {error.sourceRef}
            </span>
          )}
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full border',
            errorTypeColors[error.errorType] ?? errorTypeColors.data_corrupted
          )}>
            {errorTypeLabels[error.errorType] ?? error.errorType}
          </span>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full border',
            statusColors[error.status]
          )}>
            {statusLabels[error.status]}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-1 flex-wrap text-xs">
          {error.fieldDetail && (
            <span className="text-gray-400">
              字段: <span className="text-red-300 font-mono">{error.fieldDetail}</span>
            </span>
          )}
          {error.rowNumber !== undefined && (
            <span className="text-gray-400">
              行号: <span className="text-amber-400 font-mono">#{error.rowNumber}</span>
            </span>
          )}
          {error.photoNumber && (
            <span className="text-gray-400">
              照片: <span className="text-amber-400 font-mono">{error.photoNumber}</span>
            </span>
          )}
        </div>

        <p className="text-sm text-gray-300">{error.errorMessage}</p>
      </div>

      {error.status === 'pending' && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleResolve('fixed')}
            className="p-1.5 rounded-lg hover:bg-green-500/20 text-green-400 transition-colors"
            title="标记为已修复"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleResolve('ignored')}
            className="p-1.5 rounded-lg hover:bg-gray-500/20 text-gray-400 transition-colors"
            title="忽略"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ErrorBanner() {
  const { importErrors, setErrorPanelOpen } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ErrorStatus | 'all'>('pending');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredErrors = useMemo(() => {
    return importErrors.filter((error) => {
      if (statusFilter !== 'all' && error.status !== statusFilter) return false;
      if (sourceTypeFilter !== 'all' && error.sourceType !== sourceTypeFilter) return false;
      return true;
    });
  }, [importErrors, statusFilter, sourceTypeFilter]);

  const pendingCount = useMemo(
    () => importErrors.filter((e) => e.status === 'pending').length,
    [importErrors]
  );

  if (pendingCount === 0) return null;

  const handleClose = () => {
    setErrorPanelOpen(false);
  };

  return (
    <div className="bg-red-500/10 border-b border-red-500/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-3 text-left flex-1 cursor-pointer"
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-red-400 font-medium">
                数据导入异常
              </span>
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-mono">
                {pendingCount} 项待处理
              </span>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-red-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-red-400" />
              )}
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                showFilters ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
              )}
              title="筛选"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 pb-3 border-t border-white/5 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">状态:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ErrorStatus | 'all')}
                className="bg-gray-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-red-500/50"
              >
                <option value="all">全部</option>
                <option value="pending">待处理</option>
                <option value="fixed">已修复</option>
                <option value="ignored">已忽略</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">来源:</span>
              <select
                value={sourceTypeFilter}
                onChange={(e) => setSourceTypeFilter(e.target.value as SourceType | 'all')}
                className="bg-gray-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-red-500/50"
              >
                <option value="all">全部</option>
                <option value="point_table">点位表</option>
                <option value="photo">照片</option>
                <option value="meeting_screenshot">周会截图</option>
                <option value="plan_note">方案备注</option>
                <option value="manual_coordinate">手改坐标</option>
              </select>
            </div>
          </div>
        )}

        {expanded && (
          <div className="pb-4 space-y-2 max-h-80 overflow-y-auto">
            {filteredErrors.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">
                没有符合筛选条件的错误
              </div>
            ) : (
              filteredErrors.map((error) => (
                <ErrorItem key={error.id} error={error} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

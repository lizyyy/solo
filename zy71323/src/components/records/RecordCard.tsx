import { useState } from 'react';
import { Eye, GitBranch, GitCompare, Trash2, Zap, Calendar, Clock, Copy, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import type { EstimationRecord, RecordStatus } from '@/types';
import { useEstimationStore } from '@/store/useEstimationStore';
import { useRecordStore } from '@/store/useRecordStore';
import { cn } from '@/lib/utils';

interface RecordCardProps {
  record: EstimationRecord;
  onView: (record: EstimationRecord) => void;
  onContinue: (id: string) => void;
  onDelete?: () => void;
}

const statusConfig: Record<RecordStatus, { label: string; className: string; icon: React.ElementType }> = {
  valid: { label: '有效', className: 'bg-success-500/20 text-success-500 border-success-500/30', icon: CheckCircle2 },
  invalid: { label: '无效', className: 'bg-alert-500/20 text-alert-500 border-alert-500/30', icon: AlertTriangle },
  draft: { label: '草稿', className: 'bg-ocean-500/20 text-ocean-400 border-ocean-500/30', icon: FileText },
};

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEnergy(value: number | undefined | null): string {
  if (value === undefined || value === null) return '--';
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)} MWh`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)} kWh`;
  return `${value.toFixed(2)} Wh`;
}

export function RecordCard({ record, onView, onContinue, onDelete }: RecordCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const { loadRecord } = useEstimationStore();
  const { removeRecord, addToComparison, comparisonScenarios } = useRecordStore();

  const status = statusConfig[record.status];
  const StatusIcon = status.icon;
  const isInComparison = comparisonScenarios.some(s => s.recordId === record.id);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(record.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = () => {
    onContinue(record.id);
  };

  const handleCompare = () => {
    addToComparison(record.id, `记录 ${record.id.slice(0, 8)}`);
  };

  const handleDelete = async () => {
    await removeRecord(record.id);
    setShowDeleteConfirm(false);
    onDelete?.();
  };

  return (
    <div className="group relative bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600/50 hover:border-tech-500/50 transition-all duration-300 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-tech-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="relative p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                status.className
              )}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </div>
            {record.parentId && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ocean-600/50 text-ocean-300 text-[10px]">
                <GitBranch className="w-3 h-3" />
                续算
              </div>
            )}
          </div>
          <button
            onClick={handleCopyId}
            className="group/copy flex items-center gap-1.5 text-ocean-400 hover:text-tech-400 transition-colors"
            title={record.id}
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-success-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span className="font-mono text-sm">{record.id.slice(0, 8)}</span>
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-ocean-300 text-sm">
            <Calendar className="w-4 h-4 text-ocean-500" />
            <span>{formatDateTime(record.createdAt)}</span>
          </div>
          
          {record.result && (
            <div className="bg-ocean-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ocean-400">总能量</span>
                <Zap className="w-4 h-4 text-tech-400" />
              </div>
              <p className="text-xl font-bold text-white font-mono">
                {formatEnergy(record.result.totalEnergy)}
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-ocean-700">
                <div className="text-xs">
                  <span className="text-ocean-400">日发电量: </span>
                  <span className="text-ocean-200 font-mono">{formatEnergy(record.result.dailyGeneration)}</span>
                </div>
                <div className="text-xs">
                  <span className="text-ocean-400">容量系数: </span>
                  <span className="text-tech-400 font-mono">{(record.result.capacityFactor * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {record.note && (
            <p className="text-xs text-ocean-400 line-clamp-2">
              <span className="text-ocean-500">备注: </span>{record.note}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onView(record)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-ocean-600/50 hover:bg-ocean-600 text-ocean-200 hover:text-white text-sm transition-colors"
          >
            <Eye className="w-4 h-4" />
            查看
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-ocean-600/50 hover:bg-ocean-600 text-ocean-200 hover:text-white text-sm transition-colors"
          >
            <GitBranch className="w-4 h-4" />
            续算
          </button>
          <button
            onClick={handleCompare}
            disabled={isInComparison}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
              isInComparison
                ? 'bg-tech-500/20 text-tech-400 cursor-not-allowed'
                : 'bg-ocean-600/50 hover:bg-ocean-600 text-ocean-200 hover:text-white'
            )}
          >
            <GitCompare className="w-4 h-4" />
            {isInComparison ? '已对比' : '对比'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-lg bg-ocean-600/50 hover:bg-alert-500/20 text-ocean-400 hover:text-alert-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-ocean-900/90 backdrop-blur-sm flex items-center justify-center z-10 animate-fade-in">
          <div className="bg-ocean-800 rounded-xl p-5 border border-ocean-600 max-w-xs mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-alert-500/20">
                <Trash2 className="w-5 h-5 text-alert-500" />
              </div>
              <div>
                <p className="text-white font-medium">确认删除</p>
                <p className="text-ocean-400 text-xs">此操作无法撤销</p>
              </div>
            </div>
            <p className="text-ocean-300 text-sm mb-4">
              确定要删除记录 <span className="font-mono text-tech-400">{record.id.slice(0, 8)}</span> 吗？
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-ocean-700 hover:bg-ocean-600 text-ocean-200 text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 rounded-lg bg-alert-500 hover:bg-alert-600 text-white text-sm transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

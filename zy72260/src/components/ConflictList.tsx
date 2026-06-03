import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  FileText,
  Shield,
} from 'lucide-react';
import { ConflictRecord } from '@/types';
import { resolveConflict, getConflictEvidence } from '@/utils/conflictDetector';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface ConflictListProps {
  conflicts: ConflictRecord[];
  onResolved?: () => void;
}

export default function ConflictList({ conflicts, onResolved }: ConflictListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisionRemark, setDecisionRemark] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const updateConflict = useAppStore((s) => s.updateConflict);
  const operator = useAppStore((s) => s.operator);
  const pointCloudLog = useAppStore((s) => s.pointCloudLog);
  const setPointCloudLog = useAppStore((s) => s.setPointCloudLog);

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending');
  const resolvedConflicts = conflicts.filter((c) => c.status !== 'pending');

  const handleResolve = async (
    conflict: ConflictRecord,
    decision: 'confirmed' | 'rejected'
  ) => {
    if (!decisionRemark.trim()) {
      alert('请填写处理备注，说明决策理由');
      return;
    }

    setProcessingId(conflict.id);
    try {
      const updated = await resolveConflict(
        conflict.id,
        decision,
        decisionRemark,
        operator
      );

      if (updated) {
        updateConflict(conflict.id, updated);

        if (pointCloudLog) {
          const updatedExhibits = pointCloudLog.exhibits.map((e) => {
            if (e.exhibitId === conflict.exhibitId) {
              return {
                ...e,
                safetyRadius: updated.decision === 'use_safety_radius'
                  ? conflict.safetyRadiusValue
                  : conflict.pointCloudValue,
                radiusSource: updated.decision === 'use_safety_radius'
                  ? 'safety_table' as const
                  : 'point_cloud' as const,
              };
            }
            return e;
          });
          setPointCloudLog({
            ...pointCloudLog,
            exhibits: updatedExhibits,
          });
        }

        setDecisionRemark('');
        onResolved?.();
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const getSeverityColor = (severity: ConflictRecord['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-danger-500';
      case 'medium':
        return 'bg-warning-500';
      case 'low':
        return 'bg-blue-500';
    }
  };

  const getSeverityLabel = (severity: ConflictRecord['severity']) => {
    switch (severity) {
      case 'high':
        return '高风险';
      case 'medium':
        return '中风险';
      case 'low':
        return '低风险';
    }
  };

  const renderConflictCard = (conflict: ConflictRecord) => {
    const isExpanded = expandedId === conflict.id;
    const isPending = conflict.status === 'pending';
    const evidence = isExpanded ? getConflictEvidence(conflict) : null;

    return (
      <motion.div
        key={conflict.id}
        layout
        className={cn(
          'border rounded-lg overflow-hidden mb-3',
          isPending ? 'border-danger-300 bg-white' : 'border-gray-200 bg-gray-50'
        )}
      >
        <div
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : conflict.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isPending ? (
                <AlertTriangle className="w-5 h-5 text-danger-500" />
              ) : conflict.status === 'confirmed' ? (
                <CheckCircle className="w-5 h-5 text-success-500" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">
                    {conflict.exhibitName}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({conflict.exhibitId})
                  </span>
                  <span
                    className={cn(
                      'status-badge text-white',
                      getSeverityColor(conflict.severity)
                    )}
                  >
                    {getSeverityLabel(conflict.severity)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <span className="data-mono">
                    点云：{conflict.pointCloudValue}m
                  </span>
                  <span className="mx-2 text-gray-400">vs</span>
                  <span className="data-mono">
                    安全表：{conflict.safetyRadiusValue}m
                  </span>
                  <span className="ml-2 text-danger-600 font-medium">
                    差 {conflict.diffValue}m ({conflict.diffPercent}%)
                  </span>
                </div>
                {!isPending && (
                  <div className="text-xs text-gray-500 mt-1">
                    已{conflict.status === 'confirmed' ? '确认' : '驳回'} ·{' '}
                    {conflict.decisionOperator} ·{' '}
                    {conflict.decisionTime &&
                      new Date(conflict.decisionTime).toLocaleString('zh-CN')}
                  </div>
                )}
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && evidence && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-200 overflow-hidden"
            >
              <div className="p-4 bg-gray-50">
                <h4 className="font-semibold text-gray-700 mb-3">
                  冲突证据对比
                </h4>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-survey-600" />
                      <span className="text-sm font-medium text-gray-700">
                        {evidence.pointCloud.label}
                      </span>
                    </div>
                    <p className="text-2xl font-bold data-mono text-survey-700">
                      {evidence.pointCloud.value}m
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      来源：{evidence.pointCloud.source}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-success-600" />
                      <span className="text-sm font-medium text-gray-700">
                        {evidence.safetyRadius.label}
                      </span>
                    </div>
                    <p className="text-2xl font-bold data-mono text-success-700">
                      {evidence.safetyRadius.value}m
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      来源：{evidence.safetyRadius.source}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 my-4">
                  <div className="flex-1 h-0.5 bg-gray-300" />
                  <div className="flex items-center gap-2 px-4 py-2 bg-danger-50 rounded-full border border-danger-200">
                    <ArrowRight className="w-4 h-4 text-danger-500" />
                    <span className="text-sm font-medium text-danger-700">
                      差值 {conflict.diffValue}m ({conflict.diffPercent}%)
                    </span>
                  </div>
                  <div className="flex-1 h-0.5 bg-gray-300" />
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
                  <p className="text-sm text-gray-700">{evidence.analysis}</p>
                </div>

                {isPending && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        处理备注 <span className="text-danger-500">*</span>
                      </label>
                      <textarea
                        className="input-field"
                        rows={2}
                        placeholder="请说明决策理由，作为后续追溯依据..."
                        value={processingId === conflict.id ? decisionRemark : ''}
                        onChange={(e) => setDecisionRemark(e.target.value)}
                        disabled={processingId === conflict.id}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn-success flex-1"
                        onClick={() => handleResolve(conflict, 'confirmed')}
                        disabled={processingId === conflict.id}
                      >
                        确认（按安全半径表修正）
                      </button>
                      <button
                        className="btn-danger flex-1"
                        onClick={() => handleResolve(conflict, 'rejected')}
                        disabled={processingId === conflict.id}
                      >
                        驳回（维持点云数据）
                      </button>
                    </div>
                  </div>
                )}

                {!isPending && conflict.decisionRemark && (
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">处理备注：</p>
                    <p className="text-sm text-gray-700">
                      {conflict.decisionRemark}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {pendingConflicts.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-danger-500" />
            待处理冲突 ({pendingConflicts.length})
          </h3>
          {pendingConflicts.map(renderConflictCard)}
        </div>
      )}

      {resolvedConflicts.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success-500" />
            已处理 ({resolvedConflicts.length})
          </h3>
          {resolvedConflicts.map(renderConflictCard)}
        </div>
      )}

      {conflicts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-success-400" />
          <p className="font-medium">暂无数据冲突</p>
          <p className="text-sm mt-1">
            点云抽稀日志与安全半径表数据一致
          </p>
        </div>
      )}
    </div>
  );
}

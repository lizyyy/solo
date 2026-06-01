import { AlertTriangle, CheckCircle, Clock, ArrowRightLeft } from 'lucide-react';
import { useConflictResolution } from '../../hooks/useConflictResolution';
import { CONFLICT_TYPE_LABELS, SEVERITY_LABELS, UNIT_LABELS } from '../../types';
import { format } from 'date-fns';
import type { ConflictRecord } from '../../types';

interface ConflictResolutionPanelProps {
  batchId?: string;
}

export const ConflictResolutionPanel = ({ batchId }: ConflictResolutionPanelProps) => {
  const {
    unresolvedConflicts,
    resolvedConflicts,
    validationSummary,
    resolveConflictById,
    getConflictIcon,
    getSeverityColor,
    getResolutionLabel,
    getConflictSuggestedActions,
  } = useConflictResolution();

  const renderConflictCard = (conflict: ConflictRecord, isResolved: boolean) => (
    <div
      key={conflict.id}
      className={`p-4 rounded-lg border mb-3 transition-all ${
        isResolved ? 'bg-slate-50 border-slate-200' : getSeverityColor(conflict.severity)
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-2xl">{getConflictIcon(conflict.type)}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{CONFLICT_TYPE_LABELS[conflict.type]}</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  conflict.severity === 'critical'
                    ? 'bg-red-100 text-red-700'
                    : conflict.severity === 'error'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {SEVERITY_LABELS[conflict.severity]}
              </span>
              {isResolved && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3" />
                  已处理
                </span>
              )}
            </div>
            <p className="text-sm mt-2 opacity-90">{conflict.suggestedAction}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="p-3 bg-white/60 rounded-lg border border-white/50">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
            <Clock className="w-3 h-3" />
            传感器日志
          </div>
          <p className="font-mono text-lg font-semibold">
            {conflict.sensorData.value}
            <span className="text-sm font-normal ml-1">{UNIT_LABELS[conflict.sensorData.unit]}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono bg-slate-100 p-2 rounded break-all">
            {conflict.sensorData.rawLog}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {format(new Date(conflict.sensorData.timestamp), 'HH:mm:ss')}
          </p>
        </div>

        <div className="relative p-3 bg-white/60 rounded-lg border border-white/50">
          <div className="absolute -left-3 top-1/2 -translate-y-1/2">
            <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center">
              <ArrowRightLeft className="w-3 h-3 text-slate-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
            <Clock className="w-3 h-3" />
            导入数据
          </div>
          <p className="font-mono text-lg font-semibold">
            {conflict.importData.value}
            <span className="text-sm font-normal ml-1">{UNIT_LABELS[conflict.importData.unit]}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            来源: {conflict.importData.source === 'sensor' ? '传感器' : '导入文件'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {format(new Date(conflict.importData.timestamp), 'HH:mm:ss')}
          </p>
        </div>
      </div>

      {!isResolved && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 mr-2">选择解决方案:</span>
          {getConflictSuggestedActions(conflict).map((action) => (
            <button
              key={action.action}
              onClick={() => resolveConflictById(conflict.id, action.action)}
              className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-blue-400 transition-all"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {isResolved && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            解决方案: <span className="font-medium text-slate-700">{getResolutionLabel(conflict.resolution)}</span>
            {' · '}
            处理人: <span className="font-medium text-slate-700">{conflict.resolvedBy}</span>
            {' · '}
            {conflict.resolvedAt && format(new Date(conflict.resolvedAt), 'MM-dd HH:mm')}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">数据冲突检测</h3>
              <p className="text-amber-100 text-sm">传感器日志与导入数据对比校验</p>
            </div>
          </div>
          {validationSummary && (
            <div
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                validationSummary.canProceed
                  ? 'bg-green-500/20 text-green-100 border border-green-400/30'
                  : 'bg-red-500/20 text-red-100 border border-red-400/30'
              }`}
            >
              {validationSummary.summary}
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        {unresolvedConflicts.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              待处理冲突 ({unresolvedConflicts.length})
            </h4>
            {unresolvedConflicts.map((c) => renderConflictCard(c, false))}
          </div>
        )}

        {resolvedConflicts.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              已处理冲突 ({resolvedConflicts.length})
            </h4>
            {resolvedConflicts.map((c) => renderConflictCard(c, true))}
          </div>
        )}

        {unresolvedConflicts.length === 0 && resolvedConflicts.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
            <p className="font-medium">数据校验通过</p>
            <p className="text-sm mt-1">未发现传感器日志与导入数据的冲突</p>
          </div>
        )}
      </div>
    </div>
  );
};

import { X, User, Calendar, Code, Server, AlertTriangle, Shield } from 'lucide-react';
import { useFlagStore } from '../store/flagStore';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { getMatchTypeLabel, getSuggestedActionLabel } from '../utils/riskCalculator';
import type { FlagWithDetails } from '../types';

interface FlagDetailModalProps {
  flag: FlagWithDetails;
  onClose: () => void;
}

export function FlagDetailModal({ flag, onClose }: FlagDetailModalProps) {
  const { getEnvStatusByFlagId } = useFlagStore();
  const envStatuses = getEnvStatusByFlagId(flag.id);
  
  const getMatchTypeColor = (type: string) => {
    switch (type) {
      case 'static': return 'bg-emerald-100 text-emerald-700';
      case 'dynamic': return 'bg-red-100 text-red-700';
      case 'suspected': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-xl">
              <Shield className="w-6 h-6 text-primary-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{flag.name}</h3>
              <p className="text-sm text-gray-500 font-mono">{flag.key}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {flag.riskLevel && <RiskBadge level={flag.riskLevel} />}
            <StatusBadge status={flag.status} />
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">基本信息</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <User className="w-4 h-4" />
                  <span className="text-sm">负责人</span>
                </div>
                <p className="font-medium text-gray-900">{flag.owner || '-'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">上线日期</span>
                </div>
                <p className="font-medium text-gray-900">{flag.launchDate ? formatDate(flag.launchDate) : '-'}</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">功能描述</p>
              <p className="text-gray-700">{flag.description}</p>
            </div>
          </div>

          {flag.riskReasons.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">风险评估</h4>
              <div className="space-y-3">
                {flag.riskReasons.map((reason, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border ${
                      reason.severity === 'error'
                        ? 'bg-red-50 border-red-100'
                        : 'bg-orange-50 border-orange-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                        reason.severity === 'error' ? 'text-red-500' : 'text-orange-500'
                      }`} />
                      <div>
                        <p className={`font-medium ${
                          reason.severity === 'error' ? 'text-red-800' : 'text-orange-800'
                        }`}>
                          {reason.message}
                        </p>
                        <p className={`text-sm mt-1 ${
                          reason.severity === 'error' ? 'text-red-600' : 'text-orange-600'
                        }`}>
                          {reason.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {flag.suggestedAction && (
                <div className="mt-4 p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <p className="text-sm text-primary-600 mb-1">建议操作</p>
                  <p className="font-medium text-primary-800">{getSuggestedActionLabel(flag.suggestedAction)}</p>
                </div>
              )}
            </div>
          )}

          {flag.codeReferences.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  代码引用 ({flag.codeReferences.length} 处)
                </div>
              </h4>
              <div className="space-y-3">
                {flag.codeReferences.map((ref) => (
                  <div key={ref.id} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-gray-600">
                          {ref.filePath}:{ref.lineNumber}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getMatchTypeColor(ref.matchType)}`}>
                          {getMatchTypeLabel(ref.matchType)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        置信度: {Math.round(ref.confidence * 100)}%
                      </span>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                      <code>{ref.codeSnippet}</code>
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {envStatuses.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  环境状态
                </div>
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {envStatuses.map((env) => (
                  <div key={env.id} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-900 capitalize">{env.environment}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        env.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {env.enabled ? '已启用' : '已禁用'}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">开关值</span>
                        <span className="font-mono text-gray-700">{env.value}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">灰度用户</span>
                        <span className="text-gray-700">{env.grayUsers} 人</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">灰度比例</span>
                        <span className="text-gray-700">{env.grayPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">最近检查</span>
                        <span className="text-gray-700">{formatDateTime(env.lastChecked)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-gray-50 rounded-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">操作历史</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">创建时间</span>
                <p className="text-gray-700">{formatDateTime(flag.createdAt)}</p>
              </div>
              <div>
                <span className="text-gray-500">更新时间</span>
                <p className="text-gray-700">{formatDateTime(flag.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">
            关闭
          </button>
          <button className="btn-primary">
            编辑开关
          </button>
        </div>
      </div>
    </div>
  );
}

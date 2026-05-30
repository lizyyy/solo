import { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  MapPin,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  Play,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DiagnosisIssue, Severity, IssueType } from '../../types/diagnosis';

interface DiagnosisPanelProps {
  issues: DiagnosisIssue[];
  isScanning?: boolean;
  onScan?: () => void;
  onResolve?: (issueId: string) => void;
  onLocate?: (issue: DiagnosisIssue) => void;
  onApplyFix?: (issue: DiagnosisIssue) => void;
  className?: string;
}

export function DiagnosisPanel({
  issues,
  isScanning = false,
  onScan,
  onResolve,
  onLocate,
  onApplyFix,
  className,
}: DiagnosisPanelProps) {
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all');
  const [filterType, setFilterType] = useState<IssueType | 'all'>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const filteredIssues = issues.filter((issue) => {
    const matchesSeverity = filterSeverity === 'all' || issue.severity === filterSeverity;
    const matchesType = filterType === 'all' || issue.type === filterType;
    const matchesResolved = showResolved || !issue.resolved;
    return matchesSeverity && matchesType && matchesResolved;
  });

  const errorCount = issues.filter((i) => i.severity === 'error' && !i.resolved).length;
  const warningCount = issues.filter((i) => i.severity === 'warning' && !i.resolved).length;
  const infoCount = issues.filter((i) => i.severity === 'info' && !i.resolved).length;
  const resolvedCount = issues.filter((i) => i.resolved).length;

  const severityConfig = {
    error: {
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      badge: 'bg-red-500/20 text-red-400',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      badge: 'bg-amber-500/20 text-amber-400',
    },
    info: {
      icon: Info,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      badge: 'bg-blue-500/20 text-blue-400',
    },
  };

  const typeLabels: Record<IssueType, string> = {
    normal_reversed: '法向量反转',
    boundary_gap: '边界间隙',
    sample_sparse: '采样稀疏',
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-slate-900/95 backdrop-blur border-l border-slate-700',
        className
      )}
    >
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-100">诊断结果</h3>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
              {errorCount} 错误
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
              {warningCount} 警告
            </span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
              {infoCount} 信息
            </span>
          </div>
        </div>

        <button
          onClick={onScan}
          disabled={isScanning}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors',
            isScanning
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          {isScanning ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {isScanning ? '扫描中...' : '开始扫描'}
        </button>
      </div>

      <div className="p-3 border-b border-slate-700 space-y-2">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as Severity | 'all')}
            className="flex-1 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">全部严重程度</option>
            <option value="error">错误</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as IssueType | 'all')}
            className="flex-1 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">全部类型</option>
            <option value="normal_reversed">法向量反转</option>
            <option value="boundary_gap">边界间隙</option>
            <option value="sample_sparse">采样稀疏</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">显示已解决</span>
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={cn(
              'w-8 h-4 rounded-full border transition-colors relative',
              showResolved ? 'bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                showResolved ? 'translate-x-4' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filteredIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <CheckCircle2 className="w-12 h-12 mb-2 text-emerald-500 opacity-70" />
            <p className="text-sm">暂无问题</p>
            <p className="text-xs mt-1">点击扫描按钮检测曲面质量</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredIssues.map((issue) => {
              const config = severityConfig[issue.severity];
              const SeverityIcon = config.icon;
              const isExpanded = expandedIds.has(issue.id);

              return (
                <div
                  key={issue.id}
                  className={cn(
                    'rounded-lg border overflow-hidden transition-all',
                    config.bg,
                    config.border,
                    issue.resolved && 'opacity-60'
                  )}
                >
                  <div
                    className="p-3 cursor-pointer"
                    onClick={() => toggleExpand(issue.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <SeverityIcon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('px-1.5 py-0.5 text-xs rounded', config.badge)}>
                              {typeLabels[issue.type]}
                            </span>
                            {issue.resolved && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
                                已解决
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-200 line-clamp-2">
                            {issue.message}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            检测于 {formatDate(issue.detectedAt)}
                          </p>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-700/50 p-3 space-y-3">
                      {issue.location.position && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                            <MapPin className="w-3.5 h-3.5" />
                            位置
                          </div>
                          <div className="text-xs text-slate-300 font-mono bg-slate-800/50 rounded px-2 py-1.5">
                            ({issue.location.position.x.toFixed(2)},{' '}
                            {issue.location.position.y.toFixed(2)},{' '}
                            {issue.location.position.z.toFixed(2)})
                          </div>
                        </div>
                      )}

                      {issue.location.region && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                            <MapPin className="w-3.5 h-3.5" />
                            区域
                          </div>
                          <div className="text-xs text-slate-300">
                            {issue.location.region}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                          修正建议
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {issue.suggestion}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                          下一步操作
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {issue.nextStep}
                        </p>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => onLocate?.(issue)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          定位
                        </button>
                        {!issue.resolved && (
                          <>
                            <button
                              onClick={() => onApplyFix?.(issue)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              应用修复
                            </button>
                            <button
                              onClick={() => onResolve?.(issue.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              标记解决
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>共 {issues.length} 个问题</span>
          <span className="text-emerald-400">已解决 {resolvedCount} 个</span>
        </div>
      </div>
    </div>
  );
}

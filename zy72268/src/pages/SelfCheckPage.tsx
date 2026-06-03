import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Play,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileUp,
  Tag,
  Calculator,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { useAppStore } from '../store';
import {
  runAllChecks,
  getLatestCheckResults,
} from '../services/selfCheckService';
import type { SelfCheckResult } from '../types';
import { cn } from '../lib/utils';

const checkTypes = [
  {
    type: 'duplicate-import' as const,
    label: '重复导入检测',
    description: '检测是否存在重复导入的楼层剖面草图',
    icon: FileUp,
    color: 'blue',
  },
  {
    type: 'multiple-names' as const,
    label: '多名称冲突检测',
    description: '检测同一障碍物是否被标注了多个名称',
    icon: Tag,
    color: 'orange',
  },
  {
    type: 'recalculate' as const,
    label: '补录重算一致性',
    description: '验证补录后重新计算的结果与之前是否一致',
    icon: Calculator,
    color: 'purple',
  },
  {
    type: 'export-consistency' as const,
    label: '导出一致性校验',
    description: '确保导出的明细、页面展示和接口返回数据一致',
    icon: FileSpreadsheet,
    color: 'green',
  },
];

export const SelfCheckPage: React.FC = () => {
  const { currentSketch, obstacles, conflicts, selfCheckResults, setSelfCheckResults } =
    useAppStore();
  const [isRunning, setIsRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getLatestCheckResults().then(setSelfCheckResults);
  }, [setSelfCheckResults]);

  const handleRunAllChecks = async () => {
    if (!currentSketch) return;
    setIsRunning(true);
    try {
      const results = await runAllChecks([currentSketch], obstacles, conflicts);
      setSelfCheckResults(results);
    } finally {
      setIsRunning(false);
    }
  };

  const getResultForType = (type: SelfCheckResult['type']) => {
    return selfCheckResults.find((r) => r.type === type);
  };

  const getStatusIcon = (status: SelfCheckResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-orange-500" />;
      case 'fail':
        return <XCircle size={20} className="text-red-500" />;
    }
  };

  const getColorClasses = (color: string, status?: SelfCheckResult['status']) => {
    if (status === 'pass') return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' };
    if (status === 'fail') return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
    if (status === 'warning') return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
      orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
      purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
      green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    };
    return colors[color] || colors.blue;
  };

  const passCount = selfCheckResults.filter((r) => r.status === 'pass').length;
  const warningCount = selfCheckResults.filter((r) => r.status === 'warning').length;
  const failCount = selfCheckResults.filter((r) => r.status === 'fail').length;

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 mb-2">自检中心</h1>
            <p className="text-zinc-500">
              执行核心自检项目，确保数据质量和一致性
            </p>
          </div>
          <button
            onClick={handleRunAllChecks}
            disabled={isRunning || !currentSketch}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all',
              isRunning || !currentSketch
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            )}
          >
            {isRunning ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Play size={18} />
            )}
            {isRunning ? '检测中...' : '运行全部检测'}
          </button>
        </div>

        {!currentSketch && (
          <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-center gap-3 text-orange-400">
            <AlertTriangle size={20} />
            <span>请先导入楼层剖面草图后再执行自检</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
              <CheckSquare size={16} />
              检测项总数
            </div>
            <p className="text-3xl font-bold text-zinc-200">4</p>
          </div>
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
              <CheckCircle size={16} />
              通过
            </div>
            <p className="text-3xl font-bold text-green-400">{passCount}</p>
          </div>
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 text-orange-400 text-sm mb-2">
              <AlertTriangle size={16} />
              警告
            </div>
            <p className="text-3xl font-bold text-orange-400">{warningCount}</p>
          </div>
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
              <XCircle size={16} />
              失败
            </div>
            <p className="text-3xl font-bold text-red-400">{failCount}</p>
          </div>
        </div>

        <div className="space-y-4">
          {checkTypes.map((check) => {
            const result = getResultForType(check.type);
            const isExpanded = expandedId === check.type;
            const colors = getColorClasses(check.color, result?.status);
            const Icon = check.icon;

            return (
              <div
                key={check.type}
                className={cn(
                  'bg-zinc-900 rounded-xl border transition-all overflow-hidden',
                  result ? colors.border : 'border-zinc-800'
                )}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : check.type)}
                  className="w-full p-5 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', colors.bg)}>
                      <Icon size={24} className={colors.text} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-zinc-200">{check.label}</span>
                        {result && getStatusIcon(result.status)}
                      </div>
                      <p className="text-sm text-zinc-500">{check.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {result ? (
                      <div className="text-right">
                        <div className="text-sm font-medium text-zinc-200">{result.message}</div>
                        <div className="text-xs text-zinc-600 flex items-center gap-1 justify-end mt-1">
                          <Clock size={12} />
                          {new Date(result.checkedAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-600">未检测</span>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-zinc-500" />
                    ) : (
                      <ChevronDown size={20} className="text-zinc-500" />
                    )}
                  </div>
                </button>

                {isExpanded && result && (
                  <div className="px-5 pb-5 border-t border-zinc-800 pt-4">
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <h4 className="text-sm font-medium text-zinc-300 mb-3">检测详情</h4>
                      {result.details.duplicates && Array.isArray(result.details.duplicates) && (
                        <div className="space-y-2">
                          {(result.details.duplicates as Array<{ names: string[]; count: number }>).map((dup, i) => (
                            <div key={i} className="text-sm text-zinc-400">
                              文件重复 ({dup.count}次): {dup.names.join(', ')}
                            </div>
                          ))}
                        </div>
                      )}
                      {result.details.conflicts && Array.isArray(result.details.conflicts) && (
                        <div className="space-y-2">
                          {(result.details.conflicts as Array<{ names: string; overlapPercentage: number }>).map(
                            (conflict, i) => (
                              <div key={i} className="text-sm text-zinc-400">
                                {conflict.names} (重叠率: {(conflict.overlapPercentage * 100).toFixed(1)}%)
                              </div>
                            )
                          )}
                        </div>
                      )}
                      {result.details.issues && Array.isArray(result.details.issues) && (
                        <div className="space-y-1">
                          {(result.details.issues as string[]).map((issue, i) => (
                            <div key={i} className="text-sm text-red-400">
                              • {issue}
                            </div>
                          ))}
                        </div>
                      )}
                      {result.details.missingConflicts && Array.isArray(result.details.missingConflicts) && (
                        <div className="text-sm text-orange-400 mb-2">
                          消失的冲突: {(result.details.missingConflicts as string[]).length} 个
                        </div>
                      )}
                      {result.details.newFoundConflicts && Array.isArray(result.details.newFoundConflicts) && (
                        <div className="text-sm text-blue-400">
                          新增的冲突: {(result.details.newFoundConflicts as string[]).length} 个
                        </div>
                      )}
                      {!result.details.duplicates && !result.details.conflicts && !result.details.issues &&
                        result.details.newFoundConflicts === undefined && (
                          <div className="text-sm text-green-400">所有检查项通过</div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <h3 className="font-semibold text-zinc-200 mb-4">自检项目说明</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-2">重复导入检测</h4>
              <p className="text-sm text-zinc-500">
                通过文件哈希值比对，检测是否有相同的楼层剖面草图被重复导入。
                重复导入可能导致数据冗余和冲突。
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-orange-400 mb-2">多名称冲突检测</h4>
              <p className="text-sm text-zinc-500">
                基于位置重叠率和名称相似度算法，识别同一物理障碍物被标注不同名称的情况，
                这是展陈设计师最常遇到的问题。
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-purple-400 mb-2">补录重算一致性</h4>
              <p className="text-sm text-zinc-500">
                验证补看点云抽稀日志后重新计算的冲突结果与之前的一致性，
                确保补录操作不会导致已确认的冲突消失或新增未预期的冲突。
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-green-400 mb-2">导出一致性校验</h4>
              <p className="text-sm text-zinc-500">
                确保导出的明细数据、页面展示数据和接口返回数据来自同一数据源，
                特别是多名称冲突记录不能在一个地方显示而在另一个地方消失。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

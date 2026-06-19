import { useState, useEffect } from 'react';
import { GitBranch, ArrowLeftRight, Plus, Minus, Edit3, CheckCircle, AlertTriangle, PlusCircle, XCircle, FileText, Users, Calendar, Info } from 'lucide-react';
import { api } from '../lib/api';
import { useDataStore } from '../store/dataStore';
import { useAppStore } from '../store';

import VersionTimeline from '../components/VersionTimeline';
import { cn } from '../lib/utils';
import type { ParamVersion } from '../../shared/types';

export default function VersionPage() {
  const { versions, loading, refreshAll, refreshVersions } = useDataStore();
  const { compareVersions: compareVersionsStore, setCompareVersion } = useAppStore();
  const [comparing, setComparing] = useState(false);
  const [diffResult, setDiffResult] = useState<any>(null);

  useEffect(() => {
    if (versions.length === 0) {
      refreshVersions();
    }
  }, [versions.length, refreshVersions]);

  const handleCompare = async (v1Id: string, v2Id: string) => {
    setComparing(true);
    setDiffResult(null);
    try {
      const v1 = versions.find((v) => v.id === v1Id);
      const v2 = versions.find((v) => v.id === v2Id);

      if (!v1 || !v2) {
        throw new Error('未找到版本信息');
      }

      const result = await api.compareVersions(v1.version, v2.version);
      setDiffResult(result);
    } catch (error) {
      console.error('版本对比失败:', error);
      alert('版本对比失败，请重试');
    } finally {
      setComparing(false);
    }
  };

  const handleCloseDiff = () => {
    setDiffResult(null);
    setCompareVersion(0, null);
    setCompareVersion(1, null);
  };

  const statusLabels: Record<string, string> = {
    smooth: '顺利',
    gap: '断档',
    supplement: '补录',
    conflict: '冲突',
    pending: '待处理',
    reviewed_normal: '复核正常',
    reviewed_abnormal: '复核异常',
  };

  const statusColors: Record<string, string> = {
    smooth: 'bg-green-100 text-green-700',
    gap: 'bg-orange-100 text-orange-700',
    supplement: 'bg-purple-100 text-purple-700',
    conflict: 'bg-red-100 text-red-700',
    pending: 'bg-gray-100 text-gray-700',
    reviewed_normal: 'bg-green-100 text-green-700',
    reviewed_abnormal: 'bg-red-100 text-red-700',
  };

  const statusIcons: Record<string, any> = {
    smooth: CheckCircle,
    gap: AlertTriangle,
    supplement: PlusCircle,
    conflict: XCircle,
  };

  const DiffIcon = ({ type }: { type: 'added' | 'removed' | 'modified' }) => {
    if (type === 'added') return <Plus className="w-4 h-4 text-green-600" />;
    if (type === 'removed') return <Minus className="w-4 h-4 text-red-600" />;
    return <Edit3 className="w-4 h-4 text-orange-600" />;
  };

  const ChangeTypeLabel = ({ type }: { type: 'added' | 'removed' | 'modified' }) => {
    const labels = { added: '新增', removed: '删除', modified: '修改' };
    const colors = {
      added: 'bg-green-100 text-green-700',
      removed: 'bg-red-100 text-red-700',
      modified: 'bg-orange-100 text-orange-700',
    };
    return (
      <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', colors[type])}>
        {labels[type]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">参数版本</h1>
          <p className="text-sm text-gray-500 mt-1">查看版本历史和版本差异对比</p>
        </div>
        {diffResult && (
          <div className="flex items-center gap-3">
            <button
              onClick={refreshAll}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors mr-2"
            >
              刷新
            </button>
            <button
              onClick={handleCloseDiff}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              关闭对比
            </button>
          </div>
        )}
      </div>

      {diffResult && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                版本差异对比详情
              </h2>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="px-3 py-1 bg-blue-500 text-white text-sm font-bold rounded-lg">
                    v{diffResult.fromVersion}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {diffResult.fromOperator} · {new Date(diffResult.fromCreatedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <span className="text-gray-400 text-xl">→</span>
                <div className="text-center">
                  <div className="px-3 py-1 bg-green-500 text-white text-sm font-bold rounded-lg">
                    v{diffResult.toVersion}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {diffResult.toOperator} · {new Date(diffResult.toCreatedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                来源：{diffResult.fromChangeSummary}
              </div>
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                目标：{diffResult.toChangeSummary}
              </div>
            </div>
          </div>

          {comparing ? (
            <div className="p-8 text-center text-gray-500">正在对比版本...</div>
          ) : (
            <div className="space-y-0">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-blue-600" />
                  对比摘要
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-gray-200 text-center">
                    <div className="text-xs text-gray-500">总记录数变化</div>
                    <div className="text-lg font-bold text-gray-800 mt-1">
                      {diffResult.summary.totalBefore} → {diffResult.summary.totalAfter}
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-center">
                    <div className="text-xs text-green-600">新增记录</div>
                    <div className="text-lg font-bold text-green-700 mt-1">+{diffResult.summary.added}</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-center">
                    <div className="text-xs text-red-600">删除记录</div>
                    <div className="text-lg font-bold text-red-700 mt-1">-{diffResult.summary.removed}</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 text-center">
                    <div className="text-xs text-orange-600">修改记录</div>
                    <div className="text-lg font-bold text-orange-700 mt-1">{diffResult.summary.modified}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                    <div className="text-xs text-gray-500">未变化</div>
                    <div className="text-lg font-bold text-gray-600 mt-1">{diffResult.summary.unchanged}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
                  <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    各状态数量变化
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                          类型
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          状态
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          v{diffResult.fromVersion}
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          v{diffResult.toVersion}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          变化量
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Object.entries(diffResult.countChanges)
                        .filter(([, v]: [string, any]) => v.before !== 0 || v.after !== 0)
                        .map(([status, change]: [string, any]) => {
                          const diff = change.diff;
                          const isPositive = diff > 0;
                          const isNegative = diff < 0;
                          const Icon = statusIcons[status] || AlertTriangle;
                          return (
                            <tr
                              key={status}
                              className={cn(
                                isPositive && 'bg-green-50/50',
                                isNegative && 'bg-red-50/50'
                              )}>
                              <td className="px-4 py-3">
                                <div className={cn(
                                  'w-8 h-8 rounded-lg flex items-center justify-center',
                                  statusColors[status] || 'bg-gray-100 text-gray-600'
                                )}>
                                  <Icon className="w-4 h-4" />
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium text-gray-800">
                                  {statusLabels[status] || status}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-sm text-gray-600">
                                {change.before}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-400">
                                →
                              </td>
                              <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800">
                                {change.after}
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  'font-mono text-sm font-semibold',
                                  isPositive && 'text-green-600',
                                  isNegative && 'text-red-600',
                                  !isPositive && !isNegative && 'text-gray-500'
                                )}>
                                  {isPositive ? `+${diff}` : diff}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                    记录级详细变化
                  </h3>
                </div>
                {diffResult.recordChanges.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    两个版本之间没有记录变化
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {diffResult.recordChanges.map((record: any, idx: number) => (
                      <div key={idx} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <DiffIcon type={record.changeType} />
                            <span className="font-mono font-semibold text-gray-800">
                              记录 {record.recordNo}
                            </span>
                            <ChangeTypeLabel type={record.changeType} />
                            {record.beforeStatus && (
                              <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColors[record.beforeStatus] || 'bg-gray-100 text-gray-600')}>
                                {record.beforeStatusLabel || record.beforeStatus}
                              </span>
                            )}
                            {record.changeType === 'modified' && (
                              <span className="text-gray-400">→</span>
                            )}
                            {record.afterStatus && (
                              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[record.afterStatus] || 'bg-gray-100 text-gray-600')}>
                                {record.afterStatusLabel || record.afterStatus}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-7 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-xs text-gray-500">
                                <th className="px-3 py-2 text-left font-medium">字段</th>
                                <th className="px-3 py-2 text-left font-medium">v{diffResult.fromVersion}</th>
                                <th className="w-12"></th>
                                <th className="px-3 py-2 text-left font-medium">v{diffResult.toVersion}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {record.fieldChanges.map((fc: any, fIdx: number) => (
                                <tr key={fIdx}>
                                  <td className="px-3 py-2 text-gray-600 font-medium whitespace-nowrap">
                                    {fc.fieldLabel}
                                  </td>
                                  <td className="px-3 py-2 text-gray-500 font-mono max-w-xs truncate">
                                    {String(fc.before).length > 50 ? String(fc.before).slice(0, 50) + '...' : String(fc.before)}
                                  </td>
                                  <td className="text-center text-gray-300">→</td>
                                  <td className={cn(
                                    'px-3 py-2 font-mono font-semibold max-w-xs truncate',
                                    record.changeType === 'added' && 'text-green-600',
                                    record.changeType === 'removed' && 'text-red-600 line-through',
                                    record.changeType === 'modified' && 'text-orange-600'
                                  )}>
                                    {String(fc.after).length > 50 ? String(fc.after).slice(0, 50) + '...' : String(fc.after)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                  <Plus className="w-3 h-3 text-white" />
                </div>
                <span className="text-gray-600">新增</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded flex items-center justify-center">
                  <Minus className="w-3 h-3 text-white" />
                </div>
                <span className="text-gray-600">删除</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center">
                  <Edit3 className="w-3 h-3 text-white" />
                </div>
                <span className="text-gray-600">修改</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && versions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          加载中...
        </div>
      ) : versions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">暂无版本记录</p>
        </div>
      ) : (
        <div>
          <VersionTimeline versions={versions} onCompare={handleCompare} />

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">版本统计汇总</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {versions.slice(0, 4).map((version) => {
                const Icon = statusIcons['smooth'] || CheckCircle;
                return (
                  <div key={version.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-gray-900">v{version.version}</span>
                        {version === versions[0] && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            当前
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{version.createdAt}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['smooth', 'gap', 'supplement', 'conflict'] as const).map((key) => {
                        const SIcon = statusIcons[key] || AlertTriangle;
                        return (
                          <div
                            key={key}
                            className={cn(
                              'flex items-center justify-between p-2 rounded-lg',
                              statusColors[key] || 'bg-gray-100 text-gray-600'
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <SIcon className="w-4 h-4" />
                              <span className="text-xs font-medium">{statusLabels[key] || key}</span>
                            </div>
                            <span className="font-mono font-semibold">
                              {version.recordCount[key] || 0}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {version.changeSummary && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">{version.changeSummary}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

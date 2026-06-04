import { useState, useEffect } from 'react';
import { GitBranch, ArrowLeftRight, Plus, Minus, Edit3, CheckCircle, AlertTriangle, PlusCircle, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store';

import VersionTimeline from '../components/VersionTimeline';
import { cn } from '../lib/utils';

interface VersionDiff {
  field: string;
  from: string | number;
  to: string | number;
  type: 'add' | 'delete' | 'modify';
}

export default function VersionPage() {
  const { versions, setVersions, setCompareVersion } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [diffResult, setDiffResult] = useState<{
    fromVersion: string;
    toVersion: string;
    changes: VersionDiff[];
  } | null>(null);

  useEffect(() => {
    const loadVersions = async () => {
      setLoading(true);
      try {
        const data = await api.getVersions();
        setVersions(data);
      } catch (error) {
        console.error('加载版本列表失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVersions();
  }, [setVersions]);

  const handleCompare = async (v1: string, v2: string) => {
    setComparing(true);
    setDiffResult(null);
    try {
      const result = await api.compareVersions(v1, v2);
      const changes: VersionDiff[] = result.changes.map((c) => ({
        ...c,
        type: c.from === '' || c.from === 0 ? 'add' : c.to === '' || c.to === 0 ? 'delete' : 'modify',
      }));
      setDiffResult({
        fromVersion: result.fromVersion,
        toVersion: result.toVersion,
        changes,
      });
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

  const statusColors = {
    smooth: 'bg-green-100 text-green-700',
    gap: 'bg-orange-100 text-orange-700',
    supplement: 'bg-purple-100 text-purple-700',
    conflict: 'bg-red-100 text-red-700',
  };

  const statusLabels = {
    smooth: '正常',
    gap: '断档',
    supplement: '补录',
    conflict: '冲突',
  };

  const statusIcons = {
    smooth: CheckCircle,
    gap: AlertTriangle,
    supplement: PlusCircle,
    conflict: XCircle,
  };

  const DiffIcon = ({ type }: { type: 'add' | 'delete' | 'modify' }) => {
    if (type === 'add') return <Plus className="w-4 h-4 text-green-600" />;
    if (type === 'delete') return <Minus className="w-4 h-4 text-red-600" />;
    return <Edit3 className="w-4 h-4 text-orange-600" />;
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      smoothCount: '正常记录数',
      gapCount: '断档记录数',
      supplementCount: '补录记录数',
      conflictCount: '冲突记录数',
      matchThreshold: '匹配阈值',
      gapTolerance: '断档容差',
      paramA: '参数A',
      paramB: '参数B',
    };
    return labels[field] || field;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">参数版本</h1>
          <p className="text-sm text-gray-500 mt-1">查看版本历史和版本差异对比</p>
        </div>
        {diffResult && (
          <button
            onClick={handleCloseDiff}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            关闭对比
          </button>
        )}
      </div>

      {diffResult && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                版本差异对比
              </h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-lg">
                  v{diffResult.fromVersion}
                </span>
                <span className="text-gray-400">→</span>
                <span className="px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-lg">
                  v{diffResult.toVersion}
                </span>
              </div>
            </div>
          </div>

          {comparing ? (
            <div className="p-8 text-center text-gray-500">正在对比版本...</div>
          ) : diffResult.changes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">两个版本之间没有差异</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                      类型
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      字段
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      v{diffResult.fromVersion}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      v{diffResult.toVersion}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {diffResult.changes.map((change, index) => (
                    <tr
                      key={index}
                      className={cn(
                        change.type === 'add' && 'bg-green-50/50',
                        change.type === 'delete' && 'bg-red-50/50',
                        change.type === 'modify' && 'bg-orange-50/50'
                      )}>
                      <td className="px-4 py-3">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center',
                          change.type === 'add' && 'bg-green-100',
                          change.type === 'delete' && 'bg-red-100',
                          change.type === 'modify' && 'bg-orange-100'
                        )}>
                          <DiffIcon type={change.type} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{getFieldLabel(change.field)}</span>
                      </td>
                      <td className={cn(
                        'px-4 py-3 font-mono text-sm',
                        change.type === 'delete' ? 'text-red-600 line-through' : 'text-gray-600'
                      )}>
                        {change.from === '' || change.from === 0 ? '-' : String(change.from)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400">
                        →
                      </td>
                      <td className={cn(
                        'px-4 py-3 font-mono text-sm',
                        change.type === 'add' ? 'text-green-600 font-semibold' :
                        change.type === 'modify' ? 'text-orange-600 font-semibold' : 'text-gray-600'
                      )}>
                        {change.to === '' || change.to === 0 ? '-' : String(change.to)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {loading ? (
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
              {versions.slice(0, 4).map((version) => (
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
                      const Icon = statusIcons[key];
                      return (
                        <div
                          key={key}
                          className={cn(
                            'flex items-center justify-between p-2 rounded-lg',
                            statusColors[key]
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-medium">{statusLabels[key]}</span>
                          </div>
                          <span className="font-mono font-semibold">
                            {version.recordCount[key]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import {
  CheckSquare,
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

export default function SelfCheck() {
  const { selfCheckResults, runSelfCheck } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunCheck = () => {
    setIsRunning(true);
    setTimeout(() => {
      runSelfCheck();
      setIsRunning(false);
    }, 1500);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle size={20} className="text-emerald-500" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-amber-500" />;
      case 'error':
        return <XCircle size={20} className="text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      pass: { label: '通过', className: 'bg-emerald-100 text-emerald-700' },
      warning: { label: '警告', className: 'bg-amber-100 text-amber-700' },
      error: { label: '异常', className: 'bg-red-100 text-red-700' },
    };
    const cfg = config[status] || config.pass;
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>
        {cfg.label}
      </span>
    );
  };

  const passCount = selfCheckResults.filter((r) => r.status === 'pass').length;
  const warningCount = selfCheckResults.filter((r) => r.status === 'warning').length;
  const errorCount = selfCheckResults.filter((r) => r.status === 'error').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">系统自检中心</h2>
          <p className="text-sm text-slate-500 mt-1">
            覆盖重复导入、施工改道同步、补录重算、导出一致性四大检测
          </p>
        </div>
        <button
          onClick={handleRunCheck}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {isRunning ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          {isRunning ? '检测中...' : '一键自检'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{passCount}</p>
              <p className="text-xs text-slate-500">通过</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{warningCount}</p>
              <p className="text-xs text-slate-500">警告</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{errorCount}</p>
              <p className="text-xs text-slate-500">异常</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <CheckSquare size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{selfCheckResults.length}</p>
              <p className="text-xs text-slate-500">检测项</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">检测结果详情</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {selfCheckResults.map((result) => (
            <div key={result.id}>
              <button
                onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-800">{result.typeName}</p>
                    <p className="text-xs text-slate-500">
                      检测时间：{new Date(result.checkedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(result.status)}
                  {expandedId === result.id ? (
                    <ChevronUp size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                </div>
              </button>
              {expandedId === result.id && (
                <div className="px-4 pb-4">
                  {result.issues.length > 0 ? (
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                      <p className="text-xs font-medium text-slate-500">发现问题：</p>
                      {result.issues.map((issue, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          {result.status === 'error' ? (
                            <XCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                          )}
                          <p className="text-sm text-slate-700">{issue}</p>
                        </div>
                      ))}
                      {result.status === 'error' && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-xs font-medium text-slate-500 mb-2">修复建议：</p>
                          <p className="text-sm text-slate-600">
                            请联系居民代表复核施工改道情况，确认后同步更新地图数据
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-50 rounded-lg p-4 flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-600" />
                      <p className="text-sm text-emerald-700">未发现问题，一切正常</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckSquare size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">自检覆盖范围说明</p>
            <ul className="text-xs text-blue-600 mt-1 space-y-1">
              <li>• 重复导入检测：检查是否有重复导入的点位数据</li>
              <li>• 施工改道同步检查：检查施工临时改道是否已同步到地图</li>
              <li>• 补录后重算：检查补录数据后相关统计是否重新计算</li>
              <li>• 导出一致性校验：检查导出的数据与系统内部数据是否一致</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

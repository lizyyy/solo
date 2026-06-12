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
  FileText,
  Database,
  Info,
  User,
  Clock,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

export default function SelfCheck() {
  const { selfCheckResults, runSelfCheck, currentUser } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(
    selfCheckResults[0]?.id || null
  );
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

  const latestResult = selfCheckResults[0];

  const passCount = latestResult?.items.filter((i) => i.status === 'pass').length || 0;
  const warningCount = latestResult?.items.filter((i) => i.status === 'warning').length || 0;
  const errorCount = latestResult?.items.filter((i) => i.status === 'error').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">系统自检中心</h2>
          <p className="text-sm text-slate-500 mt-1">
            覆盖重复导入、施工改道同步、补录重算、导出一致性四大检测，整合来源、状态、结论
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

      {latestResult && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center',
                  latestResult.overallStatus === 'pass' ? 'bg-emerald-100' :
                  latestResult.overallStatus === 'warning' ? 'bg-amber-100' : 'bg-red-100'
                )}>
                  {getStatusIcon(latestResult.overallStatus)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {latestResult.reportName}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={12} />
                      {new Date(latestResult.checkedAt).toLocaleString('zh-CN')}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <User size={12} />
                      {latestResult.operator}
                    </span>
                  </div>
                </div>
              </div>
              {getStatusBadge(latestResult.overallStatus)}
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700">{latestResult.summary}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-0 border-b border-slate-100">
            <div className="p-4 text-center border-r border-slate-100">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckSquare size={18} className="text-slate-400" />
                <span className="text-2xl font-bold text-slate-800">{latestResult.items.length}</span>
              </div>
              <p className="text-xs text-slate-500">检测项</p>
            </div>
            <div className="p-4 text-center border-r border-slate-100">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle size={18} className="text-emerald-500" />
                <span className="text-2xl font-bold text-emerald-600">{passCount}</span>
              </div>
              <p className="text-xs text-slate-500">通过</p>
            </div>
            <div className="p-4 text-center border-r border-slate-100">
              <div className="flex items-center justify-center gap-2 mb-1">
                <AlertTriangle size={18} className="text-amber-500" />
                <span className="text-2xl font-bold text-amber-600">{warningCount}</span>
              </div>
              <p className="text-xs text-slate-500">警告</p>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <XCircle size={18} className="text-red-500" />
                <span className="text-2xl font-bold text-red-600">{errorCount}</span>
              </div>
              <p className="text-xs text-slate-500">异常</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {latestResult.items.map((item) => (
              <div key={item.type} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{item.typeName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Database size={12} className="text-slate-400" />
                        <span className="text-xs text-slate-500">
                          来源：{item.source}
                        </span>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                {item.issues.length > 0 && (
                  <div className="mt-3 ml-7 space-y-1.5">
                    {item.issues.map((issue, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        {item.status === 'error' ? (
                          <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        )}
                        <span className="text-sm text-slate-600">{issue}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 ml-7 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <div className="flex items-start gap-2">
                    <FileText size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-emerald-700">检查结论</p>
                      <p className="text-xs text-emerald-600 mt-0.5">{item.conclusion}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selfCheckResults.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">历史自检报告</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {selfCheckResults.slice(1).map((result) => (
              <button
                key={result.id}
                onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}
                className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.overallStatus)}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{result.reportName}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(result.checkedAt).toLocaleString('zh-CN')} · {result.operator}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(result.overallStatus)}
                    {expandedId === result.id ? (
                      <ChevronUp size={16} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={16} className="text-slate-400" />
                    )}
                  </div>
                </div>
                {expandedId === result.id && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">{result.summary}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckSquare size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">自检覆盖范围说明</p>
            <ul className="text-xs text-blue-600 mt-1 space-y-1">
              <li>• <strong>重复导入检测</strong>：去重口径为相同点位+相同数据内容+同一来源批次，系统自动去重不翻倍</li>
              <li>• <strong>施工改道同步检查</strong>：比对施工改道上报系统与地图数据，未同步的转交居民代表复核</li>
              <li>• <strong>补录后重算</strong>：检查红线图备注补录后，相关统计数据是否重新计算</li>
              <li>• <strong>导出一致性校验</strong>：逐项比对导出模板与系统内部数据字段</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

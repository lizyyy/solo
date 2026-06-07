import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { Play, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { SelfCheckResult } from '../../shared/types';

export default function SelfCheck() {
  const { selfCheckResults, fetchSelfCheckResults, runSelfCheck, loading } = useAppStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchSelfCheckResults();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-amber-500" />;
      case 'error':
        return <XCircle size={20} className="text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-600 text-sm">
            运行四项核心自检：重复导入检测、居民意见缺失检测、补录后重算校验、导出一致性校验
          </p>
        </div>
        <button
          onClick={runSelfCheck}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Play size={18} />
          {loading ? '检测中...' : '运行自检'}
        </button>
      </div>

      <div className="space-y-4">
        {selfCheckResults.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <AlertTriangle size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">暂无自检记录，点击上方按钮运行自检</p>
          </div>
        ) : (
          selfCheckResults.map((result: SelfCheckResult) => (
            <div
              key={result.checkId}
              className={`bg-white rounded-lg border ${getStatusBg(result.status)} overflow-hidden`}
            >
              <div
                className="p-5 flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(expanded === result.checkId ? null : result.checkId)}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <h3 className="font-medium text-slate-800">{result.checkName}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{result.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {new Date(result.runTime).toLocaleString('zh-CN')}
                  </span>
                  {expanded === result.checkId ? (
                    <ChevronUp size={18} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400" />
                  )}
                </div>
              </div>

              {expanded === result.checkId && result.details.length > 0 && (
                <div className="border-t border-slate-200 bg-white/50 p-5">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">详细信息</h4>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {result.details.map((detail, idx) => (
                      <div key={idx} className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-100">
                        <pre className="whitespace-pre-wrap font-mono text-xs">
                          {JSON.stringify(detail, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

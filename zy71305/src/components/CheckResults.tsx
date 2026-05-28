import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useHoistStore } from '../store/useHoistStore';
import { CHECK_TYPE_LABELS } from '../types';

export function CheckResults() {
  const { report } = useHoistStore();

  if (!report) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">分项检查结果</h3>
        </div>
        <div className="text-center py-8 text-slate-500">
          <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>请先点击"开始计算"查看分项检查结果</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Info className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'pass':
        return 'border-green-500/30 bg-green-500/10';
      case 'warning':
        return 'border-yellow-500/30 bg-yellow-500/10';
      case 'error':
        return 'border-red-500/30 bg-red-500/10';
      default:
        return 'border-slate-600 bg-slate-700/50';
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">分项检查结果</h3>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-green-400">
            {report.checkResults.filter((r) => r.status === 'pass').length} 通过
          </span>
          <span className="text-sm text-yellow-400">
            {report.checkResults.filter((r) => r.status === 'warning').length} 警告
          </span>
          <span className="text-sm text-red-400">
            {report.checkResults.filter((r) => r.status === 'error').length} 错误
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {report.checkResults.map((result, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border ${getStatusBg(result.status)}`}
          >
            <div className="flex items-start gap-3">
              {getStatusIcon(result.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-600 text-slate-300">
                    {CHECK_TYPE_LABELS[result.type]}
                  </span>
                  {result.location && (
                    <span className="text-xs text-slate-400">
                      位置: {result.location}
                    </span>
                  )}
                </div>
                <p className="text-white text-sm">{result.message}</p>
                <p className="text-slate-400 text-xs mt-1">
                  💡 {result.suggestion}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

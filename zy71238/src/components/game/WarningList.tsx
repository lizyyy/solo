import React from 'react';
import { AlertTriangle, AlertCircle, TrendingUp, DollarSign, X } from 'lucide-react';
import type { Warning } from '../../types';

interface WarningListProps {
  warnings: Warning[];
  onDismiss: (id: string) => void;
}

export const WarningList: React.FC<WarningListProps> = ({ warnings, onDismiss }) => {
  const getWarningIcon = (type: Warning['type']) => {
    switch (type) {
      case 'cash_excess':
        return <DollarSign size={18} />;
      case 'suspension_mismatch':
        return <AlertCircle size={18} />;
      case 'error_accumulation':
        return <TrendingUp size={18} />;
      default:
        return <AlertTriangle size={18} />;
    }
  };

  const getWarningTitle = (type: Warning['type']) => {
    switch (type) {
      case 'cash_excess':
        return '现金比例过高';
      case 'suspension_mismatch':
        return '停牌股票问题';
      case 'error_accumulation':
        return '误差持续扩大';
      default:
        return '警告';
    }
  };

  if (warnings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">⚠️ 风险监控</h3>
        <div className="text-center text-gray-500 py-6">
          <AlertTriangle size={32} className="mx-auto mb-2 text-green-500" />
          <p>暂无警告，继续保持！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-3">
        ⚠️ 风险监控 
        <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 rounded text-sm">
          {warnings.length}
        </span>
      </h3>
      
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {warnings.map((warning) => (
          <div
            key={warning.id}
            className={`p-3 rounded border ${
              warning.severity === 'critical'
                ? 'bg-red-50 border-red-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-2">
                <span className={warning.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'}>
                  {getWarningIcon(warning.type)}
                </span>
                <div>
                  <div className={`font-medium text-sm ${
                    warning.severity === 'critical' ? 'text-red-700' : 'text-yellow-700'
                  }`}>
                    {getWarningTitle(warning.type)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {warning.message}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    💡 {warning.suggestion}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onDismiss(warning.id)}
                className="p-1 hover:bg-white rounded transition-colors"
              >
                <X size={14} className="text-gray-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

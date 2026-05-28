import React from 'react';
import type { OperationLog } from '../../types';

interface OperationLogTableProps {
  logs: OperationLog[];
}

export const OperationLogTable: React.FC<OperationLogTableProps> = ({ logs }) => {
  const getTypeLabel = (type: OperationLog['type']) => {
    switch (type) {
      case 'buy': return '买入';
      case 'sell': return '卖出';
      case 'eventHandle': return '事件处理';
      default: return type;
    }
  };

  const getTypeColor = (type: OperationLog['type']) => {
    switch (type) {
      case 'buy': return 'bg-green-100 text-green-700';
      case 'sell': return 'bg-red-100 text-red-700';
      case 'eventHandle': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">📋 操作日志</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-2 px-3">回合</th>
              <th className="text-left py-2 px-3">类型</th>
              <th className="text-left py-2 px-3">股票</th>
              <th className="text-right py-2 px-3">数量</th>
              <th className="text-right py-2 px-3">价格</th>
              <th className="text-left py-2 px-3">描述</th>
              <th className="text-right py-2 px-3">误差影响</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice().reverse().map((log, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 font-mono">{log.round}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(log.type)}`}>
                    {getTypeLabel(log.type)}
                  </span>
                </td>
                <td className="py-2 px-3">
                  {log.stockName ? (
                    <div>
                      <div className="font-medium">{log.stockName}</div>
                      <div className="text-xs text-gray-500 font-mono">{log.stockCode}</div>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="py-2 px-3 text-right font-mono">{log.quantity || '-'}</td>
                <td className="py-2 px-3 text-right font-mono">
                  {log.price ? `¥${log.price.toFixed(2)}` : '-'}
                </td>
                <td className="py-2 px-3 text-gray-600 max-w-xs truncate">{log.description}</td>
                <td className={`py-2 px-3 text-right font-mono ${
                  log.trackingErrorImpact > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {log.trackingErrorImpact > 0 ? '+' : ''}
                  {(log.trackingErrorImpact * 100).toFixed(3)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {logs.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          暂无操作记录
        </div>
      )}
    </div>
  );
};

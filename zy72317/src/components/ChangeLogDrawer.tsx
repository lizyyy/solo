import React from 'react';
import { X, Clock, User, FileText } from 'lucide-react';
import type { ChangeRecord } from '../../shared/types';
import dayjs from 'dayjs';

interface ChangeLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  changes: ChangeRecord[];
  originalLineNo: number;
  currentLineNo: number;
}

const actionLabels: Record<string, string> = {
  import: '导入',
  delete: '删除',
  supplement: '补录',
  recalculate: '重算',
  status_update: '状态更新',
};

const actionColors: Record<string, string> = {
  import: 'bg-green-500',
  delete: 'bg-red-500',
  supplement: 'bg-blue-500',
  recalculate: 'bg-purple-500',
  status_update: 'bg-warning-500',
};

export const ChangeLogDrawer: React.FC<ChangeLogDrawerProps> = ({
  isOpen,
  onClose,
  changes,
  originalLineNo,
  currentLineNo,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl transform transition-transform">
        <div className="h-full flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-gray-900">变更历史</h3>
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    原始行号：{originalLineNo === -1 ? '补录' : originalLineNo}
                  </span>
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    当前编号：{currentLineNo}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {changes.length === 0 ? (
              <p className="text-center text-gray-500 py-8">暂无变更记录</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-6">
                  {changes.map((change, index) => (
                    <div key={index} className="relative pl-8">
                      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full ${actionColors[change.action] || 'bg-gray-500'} flex items-center justify-center text-white text-xs font-bold`}>
                        {index + 1}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${actionColors[change.action] || 'bg-gray-500'}`}>
                            {actionLabels[change.action] || change.action}
                          </span>
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="w-3 h-3 mr-1" />
                            {dayjs(change.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                          <User className="w-4 h-4 mr-1" />
                          <span>{change.operator}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{change.remark}</p>
                        {change.beforeValue && (
                          <div className="text-xs text-gray-500 mb-1">
                            <span className="text-red-600 font-medium">变更前：</span>
                            <pre className="mt-1 bg-red-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(change.beforeValue, null, 2)}
                            </pre>
                          </div>
                        )}
                        {change.afterValue && (
                          <div className="text-xs text-gray-500">
                            <span className="text-green-600 font-medium">变更后：</span>
                            <pre className="mt-1 bg-green-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(change.afterValue, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

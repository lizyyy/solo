import { History, ArrowRight, Clock, User } from 'lucide-react';
import type { AdjustmentRecord } from '../types';

interface HistoryPanelProps {
  adjustments: AdjustmentRecord[];
}

export function HistoryPanel({ adjustments }: HistoryPanelProps) {
  if (adjustments.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">暂无调整记录</h2>
          <p className="text-gray-500">手动调整团员声部后，记录会显示在这里</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <History className="w-6 h-6" />
          调整历史
        </h1>
        <p className="text-gray-500">记录所有手动调整操作</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {adjustments.map((adjustment) => (
            <div key={adjustment.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-purple-100 rounded-lg mt-1">
                  <ArrowRight className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-800">{adjustment.memberName}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(adjustment.timestamp).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {adjustment.oldPartName}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm font-medium">
                      {adjustment.newPartName}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="text-gray-500">调整原因：</span>
                    {adjustment.reason}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <User className="w-3 h-3" />
                    操作人：{adjustment.operator}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

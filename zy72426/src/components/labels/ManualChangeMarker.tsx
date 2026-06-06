import { useState } from 'react';
import type { ManualChange } from '@/types';
import { Edit3, Clock, User } from 'lucide-react';

interface ManualChangeMarkerProps {
  changes: ManualChange[];
}

const fieldLabels: Record<string, string> = {
  audioNote: '音频备注',
  emotionTag: '情绪标签',
  status: '处理状态',
  liveName: '现场名',
  copyrightName: '版权名',
};

export const ManualChangeMarker = ({ changes }: ManualChangeMarkerProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (changes.length === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
      >
        <Edit3 className="w-3 h-3" />
        {changes.length}
      </button>

      {showTooltip && (
        <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded shadow-lg p-3 text-left">
          <p className="text-xs font-medium text-gray-700 mb-2">改动历史</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {changes.map((change) => (
              <div key={change.id} className="text-xs border-l-2 border-blue-300 pl-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    {fieldLabels[change.field] || change.field}
                  </span>
                  <span className="text-gray-400 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {change.operator}
                  </span>
                </div>
                <p className="text-gray-500 mt-0.5">
                  <span className="line-through text-red-500">{change.oldValue || '(空)'}</span>
                  {' → '}
                  <span className="text-green-600">{change.newValue || '(空)'}</span>
                </p>
                <p className="text-gray-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(change.timestamp).toLocaleString('zh-CN')}
                </p>
                {change.reason && <p className="text-gray-500 mt-0.5 italic">原因: {change.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

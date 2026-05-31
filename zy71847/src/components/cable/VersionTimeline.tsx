import React from 'react';
import { VersionHistory, OPERATION_TYPE_LABELS } from '@/types';
import { RotateCcw, Edit3, Trash2, Plus, Download, User, Clock } from 'lucide-react';

interface VersionTimelineProps {
  versions: VersionHistory[];
  onRollback?: (version: VersionHistory) => void;
}

const operationIcons = {
  create: <Plus className="w-4 h-4" />,
  update: <Edit3 className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  rollback: <RotateCcw className="w-4 h-4" />,
  import: <Download className="w-4 h-4" />,
};

const operationColors = {
  create: 'bg-signal-green text-white',
  update: 'bg-signal-blue text-white',
  delete: 'bg-signal-red text-white',
  rollback: 'bg-signal-orange text-white',
  import: 'bg-industrial-600 text-white',
};

export const VersionTimeline: React.FC<VersionTimelineProps> = ({ versions, onRollback }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-gray-500" />
        历史版本记录
      </h4>

      <div className="relative">
        <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-200" />

        <div className="space-y-4">
          {versions.map((version, index) => (
            <div key={version.id} className="relative pl-12 animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
              <div className={`absolute left-3 w-5 h-5 rounded-full flex items-center justify-center ${operationColors[version.operation]}`}>
                {operationIcons[version.operation]}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold bg-industrial-800 text-white px-2 py-0.5 rounded">
                        v{version.version}
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {OPERATION_TYPE_LABELS[version.operation]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {version.operator}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(version.createdAt)}
                      </span>
                    </div>
                  </div>
                  {index > 0 && onRollback && (
                    <button
                      onClick={() => onRollback(version)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-signal-orange bg-orange-50 rounded hover:bg-orange-100 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      回滚到此版本
                    </button>
                  )}
                </div>

                {version.reason && (
                  <p className="text-sm text-gray-600 bg-white rounded px-2 py-1.5 border border-gray-100">
                    {version.reason}
                  </p>
                )}

                <div className="mt-2 text-xs text-gray-500 font-mono">
                  <span className="text-gray-400">坐标:</span>
                  ({version.snapshot.startPoint.x}, {version.snapshot.startPoint.y}) →
                  ({version.snapshot.endPoint.x}, {version.snapshot.endPoint.y})
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

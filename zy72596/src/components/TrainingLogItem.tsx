import { useState } from 'react';
import { Edit2, Save, X, Check } from 'lucide-react';
import { TrainingLog } from '@/types';
import { formatDate } from '@/utils/common';
import { useReviewStore } from '@/store/useReviewStore';

interface TrainingLogItemProps {
  log: TrainingLog;
  showLineNumber?: boolean;
}

export function TrainingLogItem({ log, showLineNumber = true }: TrainingLogItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(log.content);
  const updateTrainingLog = useReviewStore(s => s.updateTrainingLog);
  const currentUser = useReviewStore(s => s.currentUser);

  const handleSave = () => {
    if (editValue.trim() !== log.content) {
      updateTrainingLog(log.id, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(log.content);
    setIsEditing(false);
  };

  const hasDefaultIssue = log.content.includes('默认分') || log.content.includes('default_score');

  return (
    <div
      className={`group flex border-b border-primary-100 hover:bg-primary-50/50 transition-colors ${
        hasDefaultIssue ? 'bg-orange-50/30' : ''
      }`}
    >
      {showLineNumber && (
        <div className="w-16 flex-shrink-0 py-3 px-3 bg-primary-50 text-right text-primary-400 font-mono text-xs select-none border-r border-primary-100">
          {log.originalLineNumber}
        </div>
      )}
      <div className="flex-1 py-3 px-4 min-w-0">
        {isEditing ? (
          <div className="flex gap-2">
            <textarea
              className="flex-1 px-3 py-2 border border-primary-300 rounded font-mono text-sm resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={handleSave}
                className="p-2 text-green-600 hover:bg-green-50 rounded"
                title="保存"
              >
                <Save size={16} />
              </button>
              <button
                onClick={handleCancel}
                className="p-2 text-primary-400 hover:bg-primary-100 rounded"
                title="取消"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <pre className="font-mono text-sm whitespace-pre-wrap break-all text-primary-800">
                {log.content}
              </pre>
              {log.isModified && (
                <div className="mt-1 flex items-center gap-2 text-xs text-primary-500">
                  <span className="inline-flex items-center gap-1">
                    <Edit2 size={12} />
                    由 {log.modifiedBy} 于 {formatDate(log.modifiedAt!)} 修改
                  </span>
                  {log.originalContent !== log.content && (
                    <span className="text-primary-400">
                      (原始: {log.originalContent.length > 60 ? log.originalContent.slice(0, 60) + '...' : log.originalContent})
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="flex-shrink-0 p-1.5 text-primary-400 hover:text-primary-700 hover:bg-primary-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="编辑内容"
            >
              <Edit2 size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 py-3 px-3 flex items-center">
        {hasDefaultIssue && (
          <span className="badge bg-orange-100 text-orange-700 border-orange-200">默认分</span>
        )}
        {log.isModified && !hasDefaultIssue && (
          <span className="badge bg-blue-50 text-blue-700 border-blue-200">已修改</span>
        )}
      </div>
    </div>
  );
}

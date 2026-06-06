import { useMemo } from 'react';
import { renderDiffToHtml } from '../utils/historyTracker';

interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  fieldName?: string;
}

export default function DiffViewer({ oldValue, newValue, fieldName }: DiffViewerProps) {
  const diffHtml = useMemo(() => {
    return renderDiffToHtml(oldValue, newValue);
  }, [oldValue, newValue]);

  return (
    <div className="space-y-3">
      {fieldName && (
        <div className="text-sm font-medium text-primary-700">
          字段：{fieldName}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-1 font-medium">修改前</div>
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200 remark-preserve text-sm text-gray-700">
            {oldValue || <span className="text-gray-400 italic">（空）</span>}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1 font-medium">修改后</div>
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200 remark-preserve text-sm">
            {newValue || <span className="text-gray-400 italic">（空）</span>}
          </div>
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1 font-medium">差异对比</div>
        <div
          className="p-3 bg-white rounded-md border border-gray-200 remark-preserve text-sm"
          dangerouslySetInnerHTML={{ __html: diffHtml }}
        />
      </div>
    </div>
  );
}

import { getFieldDisplayName, formatValue } from '@/utils/changeTracker';

interface DiffViewerProps {
  fieldName: string;
  oldValue: string;
  newValue: string;
  compact?: boolean;
}

export function DiffViewer({ fieldName, oldValue, newValue, compact = false }: DiffViewerProps) {
  const displayName = getFieldDisplayName(fieldName);

  if (compact) {
    return (
      <div className="flex items-start gap-3 py-2">
        <span className="text-sm font-medium text-gray-700 min-w-[100px]">{displayName}</span>
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {oldValue && (
            <span className="px-2 py-1 bg-red-50 text-red-700 text-sm rounded line-through">
              {formatValue(fieldName, oldValue)}
            </span>
          )}
          <span className="text-gray-400">→</span>
          <span className="px-2 py-1 bg-green-50 text-green-700 text-sm rounded font-medium">
            {formatValue(fieldName, newValue)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">{displayName}</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        <div className="p-3 bg-red-50/50">
          <div className="text-xs text-red-600 font-medium mb-1">修改前</div>
          <div className="text-sm text-gray-800 line-through">
            {oldValue ? formatValue(fieldName, oldValue) : '-'}
          </div>
        </div>
        <div className="p-3 bg-green-50/50">
          <div className="text-xs text-green-600 font-medium mb-1">修改后</div>
          <div className="text-sm text-gray-800 font-medium">
            {formatValue(fieldName, newValue)}
          </div>
        </div>
      </div>
    </div>
  );
}

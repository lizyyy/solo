import type { ConflictInfo } from '../types';
import { getConflictTypeLabel, getConflictTypeColor } from '../utils/format';

interface ConflictPanelProps {
  conflict: ConflictInfo;
  className?: string;
}

export default function ConflictPanel({ conflict, className = '' }: ConflictPanelProps) {
  return (
    <div className={`border-2 border-orange-200 rounded-xl overflow-hidden ${className}`}>
      <div className={`px-4 py-3 ${getConflictTypeColor(conflict.type)}`}>
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">冲突类型: {getConflictTypeLabel(conflict.type)}</span>
        </div>
      </div>
      
      <div className="p-4 space-y-4 bg-white">
        {(conflict.modelClaim !== null || conflict.importedClaim !== null) && (
          <div className="grid grid-cols-2 gap-4">
            {conflict.modelClaim !== null && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs font-medium text-blue-600 mb-1">模型主张</p>
                <p className="text-sm font-mono text-blue-900">{conflict.modelClaim}</p>
              </div>
            )}
            {conflict.importedClaim !== null && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs font-medium text-green-600 mb-1">导入数据主张</p>
                <p className="text-sm font-mono text-green-900">{conflict.importedClaim}</p>
              </div>
            )}
          </div>
        )}

        <div className="p-4 bg-orange-50 rounded-lg">
          <p className="text-sm font-medium text-orange-900 mb-2">差异说明</p>
          <p className="text-sm text-orange-800">{conflict.evidenceDiff}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">建议动作</p>
          <ul className="space-y-2">
            {conflict.suggestedActions.map((action, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                  {idx + 1}
                </span>
                <span className="text-sm text-gray-700">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

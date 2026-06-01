import React from 'react';
import { AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import type { DataConflict } from '@/types';
import { cn } from '@/lib/utils';

interface ConflictResolverProps {
  conflicts: DataConflict[];
  onResolve: (conflictId: string, resolution: 'use_preset' | 'use_imported') => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflicts,
  onResolve,
  className = '',
  style,
}) => {
  const unresolvedCount = conflicts.filter(c => !c.resolved).length;

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)} style={style}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning-600" />
          <h3 className="font-semibold text-gray-800 font-serif">
            数据冲突检测
          </h3>
        </div>
        <span className="text-sm text-gray-500">
          {unresolvedCount > 0 
            ? `还有 ${unresolvedCount} 项待处理`
            : '所有冲突已解决'}
        </span>
      </div>

      <div className="space-y-4">
        {conflicts.map((conflict, index) => (
          <ConflictCard
            key={conflict.id}
            conflict={conflict}
            index={index}
            onResolve={onResolve}
          />
        ))}
      </div>

      {unresolvedCount === 0 && (
        <div className="bg-success-50 border border-success-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-success-600" />
          <span className="text-success-800 text-sm">
            所有数据冲突已解决，可放心使用。
          </span>
        </div>
      )}
    </div>
  );
};

interface ConflictCardProps {
  conflict: DataConflict;
  index: number;
  onResolve: (conflictId: string, resolution: 'use_preset' | 'use_imported') => void;
}

const ConflictCard: React.FC<ConflictCardProps> = ({ conflict, index, onResolve }) => {
  return (
    <div
      className={cn(
        'border rounded-xl p-5 transition-all duration-300',
        conflict.resolved
          ? 'bg-gray-50 border-gray-200'
          : 'bg-white border-warning-300 shadow-sm hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-warning-100 text-warning-700 text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <h4 className="font-medium text-gray-800">{conflict.field}</h4>
        </div>
        {conflict.resolved && (
          <span className={cn(
            'text-xs px-2 py-1 rounded',
            conflict.resolution === 'use_preset'
              ? 'bg-subway-100 text-subway-700'
              : 'bg-success-100 text-success-700'
          )}>
            {conflict.resolution === 'use_preset' ? '使用预设' : '使用导入'}
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className={cn(
          'p-4 rounded-lg border-2 transition-all',
          conflict.resolved && conflict.resolution === 'use_preset'
            ? 'border-subway-500 bg-subway-50'
            : 'border-gray-200 bg-gray-50'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-600">
              预设数据
            </span>
            {conflict.resolved && conflict.resolution === 'use_preset' && (
              <CheckCircle2 className="w-4 h-4 text-subway-600" />
            )}
          </div>
          <div className="text-lg font-bold text-gray-800 mb-2">
            {conflict.presetValue !== null && conflict.presetValue !== undefined
              ? String(conflict.presetValue)
              : <span className="text-gray-400 italic">空值</span>}
          </div>
          <div className="text-xs text-gray-500 line-clamp-2">
            {conflict.presetEvidence}
          </div>
        </div>

        <div className="flex items-center justify-center">
          <ArrowRight className="w-6 h-6 text-gray-400" />
        </div>

        <div className={cn(
          'p-4 rounded-lg border-2 transition-all',
          conflict.resolved && conflict.resolution === 'use_imported'
            ? 'border-success-500 bg-success-50'
            : 'border-gray-200 bg-gray-50'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-600">
              导入数据
            </span>
            {conflict.resolved && conflict.resolution === 'use_imported' && (
              <CheckCircle2 className="w-4 h-4 text-success-600" />
            )}
          </div>
          <div className="text-lg font-bold text-gray-800 mb-2">
            {conflict.importedValue !== null && conflict.importedValue !== undefined
              ? String(conflict.importedValue)
              : <span className="text-gray-400 italic">空值</span>}
          </div>
          <div className="text-xs text-gray-500 line-clamp-2">
            {conflict.importedEvidence}
          </div>
        </div>
      </div>

      <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 mb-4">
        <div className="text-sm text-warning-800">
          <span className="font-semibold">建议：</span>
          {conflict.suggestion}
        </div>
      </div>

      {!conflict.resolved ? (
        <div className="flex gap-3">
          <button
            onClick={() => onResolve(conflict.id, 'use_preset')}
            className="flex-1 py-2 px-4 bg-subway-600 hover:bg-subway-700 text-white rounded-lg text-sm font-medium transition-all hover:shadow-md"
          >
            使用预设数据
          </button>
          <button
            onClick={() => onResolve(conflict.id, 'use_imported')}
            className="flex-1 py-2 px-4 bg-success-600 hover:bg-success-700 text-white rounded-lg text-sm font-medium transition-all hover:shadow-md"
          >
            使用导入数据
          </button>
        </div>
      ) : (
        <button
          onClick={() => onResolve(conflict.id, conflict.resolution === 'use_preset' ? 'use_imported' : 'use_preset')}
          className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all"
        >
          重新选择
        </button>
      )}
    </div>
  );
};

export default ConflictResolver;

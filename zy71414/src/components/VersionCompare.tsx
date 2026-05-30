import type { VersionDiff } from '../types';
import { VersionComparator } from '../services/VersionComparator';

interface VersionCompareProps {
  diffs: VersionDiff[];
}

export function VersionCompare({ diffs }: VersionCompareProps) {
  const changedDiffs = VersionComparator.getChangedFields(diffs);

  if (changedDiffs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>两次提交内容完全一致，属于重复提交</p>
        <p className="text-sm mt-1">无实质性变更</p>
      </div>
    );
  }

  const getChangeStyle = (type: VersionDiff['changeType']) => {
    switch (type) {
      case 'ADD':
        return 'bg-success-50 text-success-700 border-success-200';
      case 'MODIFY':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DELETE':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getChangeLabel = (type: VersionDiff['changeType']) => {
    switch (type) {
      case 'ADD':
        return '新增';
      case 'MODIFY':
        return '修改';
      case 'DELETE':
        return '删除';
      default:
        return '无变化';
    }
  };

  return (
    <div>
      <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded">
        <p className="text-sm text-primary-700">
          检测到 <span className="font-bold">{changedDiffs.length}</span> 处实质性变更
        </p>
      </div>
      <div className="space-y-3">
        {diffs.map((diff) => (
          <div
            key={diff.field}
            className={`p-3 rounded border ${getChangeStyle(diff.changeType)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{diff.fieldName}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white/60">
                {getChangeLabel(diff.changeType)}
              </span>
            </div>
            {diff.changeType === 'MODIFY' && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs opacity-70 mb-1">修改前</div>
                  <div className="font-mono line-through opacity-70">
                    {VersionComparator.formatValue(diff.oldValue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">修改后</div>
                  <div className="font-mono font-medium">
                    {VersionComparator.formatValue(diff.newValue)}
                  </div>
                </div>
              </div>
            )}
            {diff.changeType === 'ADD' && (
              <div className="text-sm font-mono">
                新增值: {VersionComparator.formatValue(diff.newValue)}
              </div>
            )}
            {diff.changeType === 'DELETE' && (
              <div className="text-sm font-mono line-through">
                删除值: {VersionComparator.formatValue(diff.oldValue)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

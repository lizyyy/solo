import React from 'react';
import { VersionDifference } from '@/types';
import { formatDiffsForDisplay } from '@/utils/versionControl';
import { ArrowRight } from 'lucide-react';

interface VersionDiffProps {
  diffs: VersionDifference[];
  title?: string;
}

const changeTypeLabels: Record<string, string> = {
  note: '策展备注',
  lighting: '灯光记录',
  artwork: '作品信息',
  other: '其他',
};

export const VersionDiff: React.FC<VersionDiffProps> = ({ diffs, title = '版本差异' }) => {
  if (diffs.length === 0) return null;

  const formattedDiffs = formatDiffsForDisplay(diffs);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      </div>
      <div className="divide-y divide-gray-100">
        {formattedDiffs.map((diff, index) => (
          <div key={index} className={`p-3 ${diff.requiresAttention ? 'bg-red-50' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {changeTypeLabels[diff.changeType]}
              </span>
              <span className="text-sm font-medium text-gray-700">{diff.fieldLabel}</span>
              {diff.requiresAttention && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                  需要注意
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="diff-old px-2 py-1 rounded flex-1">
                {diff.oldValue || '(空)'}
              </span>
              <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />
              <span className="diff-new px-2 py-1 rounded flex-1">
                {diff.newValue || '(空)'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

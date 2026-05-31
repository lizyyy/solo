import React from 'react';
import { DiffItem } from '../types';
import { formatFieldName } from '../utils/diffEngine';

interface DiffViewerProps {
  diffs: DiffItem[];
  title?: string;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ diffs, title = '差异对比' }) => {
  if (diffs.length === 0) return null;

  const getDiffClass = (type: string) => {
    switch (type) {
      case 'delete':
        return 'diff-delete';
      case 'add':
        return 'diff-add';
      case 'conflict':
        return 'diff-conflict';
      default:
        return '';
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-semibold text-gray-800 mb-3">{title}</h4>
      <div className="space-y-3">
        {diffs.map((diff, index) => (
          <div key={index} className="border border-gray-200 rounded p-3 bg-white">
            <div className="text-sm font-medium text-gray-700 mb-2">
              {formatFieldName(diff.field)}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">原值：</span>
                <span className={getDiffClass('delete')}>{formatValue(diff.oldValue)}</span>
              </div>
              <div>
                <span className="text-gray-500">新值：</span>
                <span className={getDiffClass(diff.type)}>{formatValue(diff.newValue)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiffViewer;

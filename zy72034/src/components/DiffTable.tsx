import React from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import type { FieldDiff } from '../types';
import { formatFieldName, formatDiffValue } from '../utils/diff';
import { cn } from '../lib/utils';

interface DiffTableProps {
  diffs: FieldDiff[];
  title?: string;
}

export const DiffTable: React.FC<DiffTableProps> = ({ diffs, title }) => {
  if (diffs.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
        未发现数据差异
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
      {title && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h4 className="font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            {title}
          </h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">
                字段
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">
                原值（旧口径）
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 border-b w-12">
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">
                新值（新口径）
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">
                差异
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {diffs.map((diff, index) => {
              const hasDelta = diff.delta !== undefined;
              const isPositive = hasDelta && (diff.delta as number) > 0;

              return (
                <tr
                  key={index}
                  className={cn(
                    'transition-colors',
                    hasDelta ? 'bg-red-50 hover:bg-red-100' : 'bg-yellow-50 hover:bg-yellow-100'
                  )}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {formatFieldName(diff.field)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                    {String(diff.oldValue)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ArrowRight className="w-5 h-5 text-gray-400 mx-auto" />
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-800 font-mono">
                    {String(diff.newValue)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-sm font-bold font-mono',
                      hasDelta
                        ? isPositive
                          ? 'text-green-600'
                          : 'text-red-600'
                        : 'text-yellow-600'
                    )}
                  >
                    {formatDiffValue(diff.newValue, diff.delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

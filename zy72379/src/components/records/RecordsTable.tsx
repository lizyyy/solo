import React from 'react';
import { Eye, Clock, AlertTriangle, AlertOctagon, ChevronRight } from 'lucide-react';
import type { StrainRecord } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';

interface RecordsTableProps {
  records: StrainRecord[];
  onSelectRecord: (record: StrainRecord) => void;
  selectedRecordId?: string;
}

export const RecordsTable: React.FC<RecordsTableProps> = ({ records, onSelectRecord, selectedRecordId }) => {
  const getStatusIcon = (record: StrainRecord) => {
    switch (record.recordStatus) {
      case 'over_threshold':
        return <AlertOctagon className="w-4 h-4 text-warning-500" />;
      case 'pending_review':
        return <AlertTriangle className="w-4 h-4 text-warning-500" />;
      case 'conflict':
        return <AlertTriangle className="w-4 h-4 text-danger-500" />;
      default:
        return <Clock className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getSourceBadges = (sources: ('photo' | 'note')[]) => (
    <div className="flex gap-1">
      {sources.includes('photo') && (
        <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 text-xs rounded">照片</span>
      )}
      {sources.includes('note') && (
        <span className="px-1.5 py-0.5 bg-success-100 text-success-700 text-xs rounded">备注</span>
      )}
    </div>
  );

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                记录ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                材料信息
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                原始数据
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                清洗后数据
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                证据来源
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                口径来源
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {records.map((record) => (
              <tr
                key={record.id}
                onClick={() => onSelectRecord(record)}
                className={`cursor-pointer transition-colors hover:bg-neutral-50 ${
                  selectedRecordId === record.id ? 'bg-primary-50' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(record)}
                    <span className="font-mono text-sm font-medium text-neutral-900">{record.id}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-neutral-900">{record.materialName}</div>
                  <div className="text-xs text-neutral-500">{record.materialType}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-sm font-medium text-neutral-900">
                    {record.originalValue}
                    <span className="text-xs text-neutral-500">{record.originalUnit}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className={`font-mono text-sm font-bold ${
                    record.recordStatus === 'normal' ? 'text-success-600' :
                    record.recordStatus === 'over_threshold' ? 'text-warning-600' :
                    'text-neutral-900'
                  }`}>
                    {record.cleanedValue}
                    <span className="text-xs text-neutral-500">{record.cleanedUnit}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={record.recordStatus} type="record" size="sm" />
                </td>
                <td className="px-4 py-3">
                  {getSourceBadges(record.evidenceSources)}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-neutral-600">{record.caliberSource}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRecord(record);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-primary-600 hover:bg-primary-100 rounded transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    查看
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

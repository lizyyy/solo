import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, ChevronRight, Edit, Eye, FileText, ImagePlus, XCircle } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatAmount, getStatusLabel, getStatusColor, getReviewStatusLabel, getReviewStatusColor } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { CreditRecord } from '../../shared/types';

interface RecordsTableProps {
  onScreenshot?: (record: CreditRecord) => void;
}

export function RecordsTable({ onScreenshot }: RecordsTableProps) {
  const { records, filters, setDetailRecord, setConflictRecord, setSupplementRecord } = useDashboardStore();

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      if (filters.status.length > 0 && !filters.status.includes(record.status)) {
        return false;
      }
      if (filters.hasConflict !== null && record.hasConflict !== filters.hasConflict) {
        return false;
      }
      if (filters.nameConsistent !== null && record.nameConsistent !== filters.nameConsistent) {
        return false;
      }
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        return (
          record.institutionCode.toLowerCase().includes(search) ||
          record.institutionNamePrev.toLowerCase().includes(search) ||
          record.institutionNameCurrent.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [records, filters]);

  const handleViewConflict = (record: CreditRecord) => {
    setConflictRecord(record);
  };

  const handleSupplement = (record: CreditRecord) => {
    setSupplementRecord(record);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                机构信息
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                授信额度
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                已占用
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                可用额度
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                除权日
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                复核状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredRecords.map((record) => (
              <tr 
                key={record.id} 
                className={cn(
                  'transition-colors hover:bg-gray-50',
                  !record.nameConsistent && 'bg-orange-50/30',
                  record.hasConflict && 'bg-red-50/30'
                )}
              >
                <td className="sticky left-0 z-10 bg-white px-4 py-4">
                  <div className="flex items-center gap-2">
                    {!record.nameConsistent ? (
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-500" />
                    ) : record.hasConflict ? (
                      <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {record.institutionNameCurrent}
                        </span>
                        <span className="text-xs text-gray-400">
                          {record.institutionCode}
                        </span>
                      </div>
                      {!record.nameConsistent && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-orange-600">
                          <span className="line-through text-orange-400">{record.institutionNamePrev}</span>
                          <ChevronRight className="h-3 w-3" />
                          <span>{record.institutionNameCurrent}</span>
                          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                            简称变更
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-sm text-gray-900">
                    {formatAmount(record.creditLine)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-sm text-gray-900">
                    {formatAmount(record.occupiedAmount)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={cn(
                    'font-mono text-sm',
                    record.availableAmount > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {formatAmount(record.availableAmount)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm text-gray-600">
                    {record.custodianData.exDividendDate}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                    getStatusColor(record.status)
                  )}>
                    {getStatusLabel(record.status)}
                  </span>
                  {record.hasConflict && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      有冲突
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                    getReviewStatusColor(record.reviewStatus)
                  )}>
                    {getReviewStatusLabel(record.reviewStatus)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5">
                    {onScreenshot && !record.screenshotData && (
                      <button
                        onClick={() => onScreenshot(record)}
                        className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        截图
                      </button>
                    )}
                    {record.hasConflict && (
                      <button
                        onClick={() => handleViewConflict(record)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        处理冲突
                      </button>
                    )}
                    <button
                      onClick={() => handleSupplement(record)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      补录
                    </button>
                    <button
                      onClick={() => setDetailRecord(record)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      详情
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {filteredRecords.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          <FileText className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p>暂无符合条件的记录</p>
        </div>
      )}
    </div>
  );
}

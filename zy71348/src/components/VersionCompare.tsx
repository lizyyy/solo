import { useRecordStore } from '@/store/useRecordStore';
import { ConditionBadge } from './ConditionBadge';
import { Disc, ArrowRight } from 'lucide-react';
import type { InventoryRecord } from '@/types';

interface VersionCompareProps {
  albumGroupId: string;
  currentRecordId: string;
}

export function VersionCompare({ albumGroupId, currentRecordId }: VersionCompareProps) {
  const albumRecords = useRecordStore((s) => s.getAlbumGroupRecords(albumGroupId));

  if (albumRecords.length <= 1) {
    return (
      <div className="text-center py-6 text-vinyl-500 text-sm">
        <Disc className="w-8 h-8 mx-auto mb-2 opacity-50" />
        此专辑暂无其他版本
      </div>
    );
  }

  const sortedRecords = [...albumRecords].sort((a, b) =>
    a.catalogNumber.localeCompare(b.catalogNumber)
  );

  const getDiffFields = (a: InventoryRecord, b: InventoryRecord) => {
    const diffs: string[] = [];
    if (a.catalogNumber !== b.catalogNumber) diffs.push('版号');
    if (a.pressYear !== b.pressYear) diffs.push('发行年份');
    if (a.condition !== b.condition) diffs.push('品相');
    if (a.price !== b.price) diffs.push('价格');
    if (a.shelfLocation !== b.shelfLocation) diffs.push('位置');
    return diffs;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-vinyl-600 mb-3">
        此专辑共有 <span className="font-semibold text-vinyl-800">{albumRecords.length}</span> 个版本
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedRecords.map((record, idx) => {
          const nextRecord = sortedRecords[idx + 1];
          const diffs = nextRecord ? getDiffFields(record, nextRecord) : [];
          const isCurrent = record.id === currentRecordId;

          return (
            <div
              key={record.id}
              className={`card ${isCurrent ? 'ring-2 ring-vinyl-700' : ''}`}
            >
              {isCurrent && (
                <div className="bg-vinyl-700 text-white text-xs px-2 py-0.5 rounded-sm inline-block mb-2">
                  当前查看
                </div>
              )}
              <div className="font-mono font-bold text-vinyl-900 text-lg mb-1">
                {record.catalogNumber}
              </div>
              <div className="text-sm text-vinyl-600 mb-2">
                {record.pressYear} 发行
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-vinyl-500">品相:</span>
                  <ConditionBadge condition={record.condition} />
                </div>
                <div className="flex justify-between">
                  <span className="text-vinyl-500">价格:</span>
                  <span className="font-semibold">¥{record.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-vinyl-500">位置:</span>
                  <span className="font-mono">{record.shelfLocation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-vinyl-500">寄售人:</span>
                  <span>{record.consignor}</span>
                </div>
              </div>
              {diffs.length > 0 && idx < sortedRecords.length - 1 && (
                <div className="mt-3 pt-3 border-t border-vinyl-700/10">
                  <div className="flex items-center gap-1 text-xs text-caramel-500">
                    <span>与下一版本差异:</span>
                    <span className="bg-caramel-100 px-1.5 py-0.5 rounded-sm">
                      {diffs.join(', ')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

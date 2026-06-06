import { Link } from 'react-router-dom';
import { Music, Store, Calendar, AlertTriangle, ChevronRight } from 'lucide-react';
import type { RoyaltyRecord } from '../types';
import StatusBadge from './StatusBadge';

interface RecordCardProps {
  record: RoyaltyRecord;
}

export default function RecordCard({ record }: RecordCardProps) {
  const reworkCount = record.tracks.filter(t => t.hasReworkReason).length;
  const hasOldCaliber = record.tracks.some(t => t.oldAlias);

  return (
    <Link
      to={`/record/${record.id}`}
      className="block bg-white rounded-xl shadow-card card-transition border border-primary-100 overflow-hidden"
    >
      <div className="aspect-video bg-primary-100 relative overflow-hidden">
        <img
          src={record.contractImage}
          alt="合同截图"
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          <StatusBadge status={record.status} />
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-serif font-semibold text-primary-800 text-lg">
              {record.contractNo}
            </h3>
            <div className="flex items-center gap-1 text-sm text-primary-500 mt-0.5">
              <Store className="w-3.5 h-3.5" />
              {record.recordStore}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-primary-600 mb-3">
          <div className="flex items-center gap-1">
            <Music className="w-4 h-4 text-primary-400" />
            <span>{record.tracks.length} 条轨道</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-primary-400" />
            <span>{record.importDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {reworkCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-reworkLight text-accent-rework">
              <AlertTriangle className="w-3 h-3" />
              {reworkCount} 条待复核
            </span>
          )}
          {hasOldCaliber && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-goldLight text-amber-700">
              含旧口径补录
            </span>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-primary-100 flex items-center justify-between">
          <span className="text-sm text-primary-500">查看详情</span>
          <ChevronRight className="w-4 h-4 text-primary-400" />
        </div>
      </div>
    </Link>
  );
}

import { Music, Package, MapPin, Clock, ChevronRight } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { InventoryRecord } from '@/types';
import { useNavigate } from 'react-router-dom';

interface RecordCardProps {
  record: InventoryRecord;
}

export function RecordCard({ record }: RecordCardProps) {
  const navigate = useNavigate();
  const hasMissingRegion = record.authorizedRegions.some(r => r.isMissing);
  
  return (
    <div 
      onClick={() => navigate(`/records/${record.id}`)}
      className="bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800">{record.artistName}</h4>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              {record.merchandise}
            </p>
          </div>
        </div>
        <StatusBadge status={record.status} />
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span>授权地区：</span>
          <div className="flex flex-wrap gap-1">
            {record.authorizedRegions.map((region, idx) => (
              <span 
                key={idx}
                className={`
                  px-2 py-0.5 rounded text-xs
                  ${region.isMissing 
                    ? 'bg-amber-100 text-amber-700 border border-amber-200 line-through' 
                    : 'bg-slate-100 text-slate-600'}
                `}
              >
                {region.city}
                {region.isMissing && ' (缺失)'}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Package className="w-4 h-4 text-slate-400" />
          <span>数量：{record.quantity} 件</span>
        </div>
      </div>
      
      {hasMissingRegion && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            ⚠️ 授权地区不完整，待店长复核补充
          </p>
        </div>
      )}
      
      {record.hasSupplementary && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-700">
            🔄 存在补录返工：{record.supplementaryNote}
          </p>
        </div>
      )}
      
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{record.updatedAt}</span>
        </div>
        <div className="flex items-center gap-1 text-blue-600 text-sm font-medium group-hover:gap-2 transition-all">
          查看详情
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

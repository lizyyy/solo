import {
  Package,
  MapPin,
  LayoutGrid,
  FolderClosed,
  User,
  QrCode,
  AlertCircle,
} from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { cn } from '@/lib/utils';

interface LocationGuideCardProps {
  partModel: string;
  compact?: boolean;
}

export default function LocationGuideCard({ partModel, compact = false }: LocationGuideCardProps) {
  const locations = useScheduleStore((s) => s.locations);
  const location = locations.find((l) => l.partModel === partModel);

  if (!location) {
    return (
      <div className={cn(
        'rounded-lg border border-dashed border-gray-300 bg-gray-50',
        compact ? 'p-3' : 'p-5'
      )}>
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
          <span className={compact ? 'text-xs' : 'text-sm'}>未录入位置</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="bg-blue-50 px-3 py-2 flex items-center gap-2 border-b border-blue-100">
          <Package className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-blue-700">备件位置</span>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 text-gray-700 border border-gray-200 text-[11px]">
              <MapPin className="w-3 h-3 text-amber-500" />
              仓库{location.warehouseZone}区
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 text-gray-700 border border-gray-200 text-[11px]">
              <LayoutGrid className="w-3 h-3 text-blue-500" />
              货架{location.shelfNo}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 text-gray-700 border border-gray-200 text-[11px]">
              <FolderClosed className="w-3 h-3 text-green-500" />
              {location.drawerNo}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100">
            <User className="w-3 h-3 text-gray-400" />
            <span className="text-[11px] text-gray-600">{location.contactPerson}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-blue-50 px-5 py-3 flex items-center gap-2 border-b border-blue-100">
        <Package className="w-5 h-5 text-blue-600" />
        <h4 className="font-semibold text-blue-800">备件存放位置</h4>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-sm">
            <MapPin className="w-4 h-4" />
            仓库 {location.warehouseZone} 区
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-sm">
            <LayoutGrid className="w-4 h-4" />
            货架 {location.shelfNo}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">
            <FolderClosed className="w-4 h-4" />
            {location.drawerNo}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-[120px] h-[120px] bg-white border border-gray-200 rounded-lg flex items-center justify-center shadow-sm">
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <QrCode className="w-16 h-16" />
              <span className="text-[10px]">二维码示意</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">扫码查看入库单</p>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">{location.contactPerson}</p>
            <p className="text-xs text-gray-400">库房联系人</p>
          </div>
        </div>
      </div>
    </div>
  );
}

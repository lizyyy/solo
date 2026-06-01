import { AlertTriangle, MapPin, Users, Image, Layers, Copy, AlertCircle, Target } from 'lucide-react';
import type { DataCheckResult } from '../../types';

interface DataCheckCardProps {
  result: DataCheckResult | null;
  onItemClick?: (type: string) => void;
}

const checkItems = [
  {
    key: 'coordinateOffsets',
    label: '坐标偏移',
    icon: MapPin,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    getCount: (r: DataCheckResult) => r.coordinateOffsets.length,
  },
  {
    key: 'duplicateNames',
    label: '重名设备',
    icon: Users,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    getCount: (r: DataCheckResult) => r.duplicateNames.length,
  },
  {
    key: 'missingPhotos',
    label: '缺失照片',
    icon: Image,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    getCount: (r: DataCheckResult) => r.missingPhotos.length,
  },
  {
    key: 'crossFloor',
    label: '跨楼层异常',
    icon: Layers,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    getCount: (r: DataCheckResult) => r.crossFloor.length,
  },
  {
    key: 'duplicates',
    label: '重复记录',
    icon: Copy,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    getCount: (r: DataCheckResult) => r.duplicates.length,
  },
  {
    key: 'nullValues',
    label: '空值字段',
    icon: AlertCircle,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    getCount: (r: DataCheckResult) => r.nullValues.length,
  },
  {
    key: 'boundaryRecords',
    label: '边界记录',
    icon: Target,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    getCount: (r: DataCheckResult) => r.boundaryRecords.length,
  },
];

export function DataCheckCard({ result, onItemClick }: DataCheckCardProps) {
  if (!result) {
    return (
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 text-slate-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">暂无检测结果</span>
        </div>
      </div>
    );
  }
  
  const totalIssues = checkItems.reduce((sum, item) => sum + item.getCount(result), 0);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          数据质量检测
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded ${
          totalIssues > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
        }`}>
          {totalIssues > 0 ? `${totalIssues} 项问题` : '全部正常'}
        </span>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {checkItems.map((item) => {
          const count = item.getCount(result);
          const Icon = item.icon;
          
          return (
            <button
              key={item.key}
              onClick={() => onItemClick?.(item.key)}
              className={`flex items-center justify-between p-3 rounded-lg border ${item.bgColor} ${item.borderColor} hover:brightness-110 transition-all duration-200 text-left`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${item.color}`} />
                <span className="text-sm text-slate-300">{item.label}</span>
              </div>
              <span className={`text-sm font-mono font-semibold ${
                count > 0 ? item.color : 'text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

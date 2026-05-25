import type { Commodity } from '../types/game';
import { Wine, Smartphone, Dumbbell, Package, Egg, Pill, Tv, Footprints, Refrigerator, Flower2, Droplet, Armchair, FileText, BookOpen, Shirt } from 'lucide-react';

interface CommodityCardProps {
  commodity: Commodity;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  book: <BookOpen size={16} />,
  shirt: <Shirt size={16} />,
  wine: <Wine size={16} />,
  smartphone: <Smartphone size={16} />,
  dumbbell: <Dumbbell size={16} />,
  package: <Package size={16} />,
  egg: <Egg size={16} />,
  pill: <Pill size={16} />,
  tv: <Tv size={16} />,
  footprints: <Footprints size={16} />,
  refrigerator: <Refrigerator size={16} />,
  flower: <Flower2 size={16} />,
  droplet: <Droplet size={16} />,
  armchair: <Armchair size={16} />,
  'file-text': <FileText size={16} />,
};

const weightLevelLabels: Record<string, { label: string; color: string }> = {
  light: { label: '轻', color: 'bg-green-500' },
  medium: { label: '中', color: 'bg-orange-500' },
  heavy: { label: '重', color: 'bg-red-500' },
  super_heavy: { label: '超重', color: 'bg-gray-700' },
};

const fragileLevelLabels: Record<string, { label: string; color: string }> = {
  normal: { label: '普通', color: 'bg-gray-400' },
  fragile: { label: '易碎', color: 'bg-orange-500' },
  very_fragile: { label: '极易碎', color: 'bg-red-500' },
};

const timeLevelLabels: Record<string, { label: string; color: string }> = {
  normal: { label: '普通', color: 'bg-gray-400' },
  next_day: { label: '次日达', color: 'bg-purple-500' },
  same_day: { label: '当日达', color: 'bg-blue-500' },
  express: { label: '特快', color: 'bg-red-500' },
};

export const CommodityCard = ({ commodity, isSelected, onClick, disabled }: CommodityCardProps) => {
  const weightInfo = weightLevelLabels[commodity.weightLevel];
  const fragileInfo = fragileLevelLabels[commodity.fragileLevel];
  const timeInfo = timeLevelLabels[commodity.timeLevel];
  
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`
        relative p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 scale-105' : 'border-gray-200 hover:border-blue-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
      `}
      style={{ backgroundColor: commodity.color + '20' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded flex items-center justify-center text-white"
          style={{ backgroundColor: commodity.color }}
        >
          {iconMap[commodity.icon] || <Package size={16} />}
        </div>
        <span className="font-medium text-sm text-gray-800">{commodity.name}</span>
      </div>
      
      <div className="flex flex-wrap gap-1">
        <span className={`${weightInfo.color} text-white text-xs px-2 py-0.5 rounded`}>
          {weightInfo.label} {commodity.weight}kg
        </span>
        {commodity.fragileLevel !== 'normal' && (
          <span className={`${fragileInfo.color} text-white text-xs px-2 py-0.5 rounded`}>
            {fragileInfo.label}
          </span>
        )}
        {commodity.timeLevel !== 'normal' && (
          <span className={`${timeInfo.color} text-white text-xs px-2 py-0.5 rounded`}>
            {timeInfo.label}
          </span>
        )}
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        尺寸: {commodity.width}×{commodity.height}
      </div>
      
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>
      )}
    </div>
  );
};

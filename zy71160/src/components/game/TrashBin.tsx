import React from 'react';
import { WasteCategory } from '../../types';
import { getCategoryBin } from '../../data/items';
import { cn } from '../../lib/utils';

interface TrashBinProps {
  category: WasteCategory;
  isHighlighted?: boolean;
  onClick?: () => void;
}

const TrashBin: React.FC<TrashBinProps> = ({ category, isHighlighted, onClick }) => {
  const binInfo = getCategoryBin(category);
  if (!binInfo) return null;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-end p-4 rounded-t-2xl transition-all duration-200 cursor-pointer',
        'w-28 h-36 transform',
        isHighlighted ? 'scale-110 shadow-2xl z-10' : 'hover:scale-105 hover:shadow-lg',
        binInfo.bgColor
      )}
      onClick={onClick}
      style={{
        boxShadow: isHighlighted 
          ? `0 0 30px ${binInfo.color}, 0 10px 40px rgba(0,0,0,0.3)` 
          : '0 4px 15px rgba(0,0,0,0.2)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-6 rounded-t-2xl" 
           style={{ backgroundColor: 'rgba(0,0,0,0.2)' }} />
      
      <div className="absolute top-2 left-2 right-2 h-1 rounded-full"
           style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} />
      
      <div className="text-5xl mb-2 drop-shadow-lg">
        {binInfo.emoji}
      </div>
      
      <div className="text-white text-sm font-bold text-center drop-shadow-md">
        {binInfo.name}
      </div>
      
      <div className="absolute bottom-0 left-1 right-1 h-2 rounded-b"
           style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} />
      
      <div className="absolute -bottom-2 left-0 right-0 h-3 bg-black/20 rounded-b-lg blur-sm" />
    </div>
  );
};

export default TrashBin;

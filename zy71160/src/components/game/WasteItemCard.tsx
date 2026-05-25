import React, { useRef } from 'react';
import { GameItem } from '../../types';
import { getCategoryBin } from '../../data/items';
import { cn } from '../../lib/utils';

interface WasteItemCardProps {
  item: GameItem;
  onDragStart: (e: React.MouseEvent | React.TouchEvent, item: GameItem) => void;
  conveyorOffsetY: number;
}

const WasteItemCard: React.FC<WasteItemCardProps> = ({ item, onDragStart, conveyorOffsetY }) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const binInfo = getCategoryBin(item.category);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart(e, item);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    onDragStart(e, item);
  };

  return (
    <div
      ref={itemRef}
      className={cn(
        'absolute flex items-center justify-center rounded-2xl cursor-grab active:cursor-grabbing',
        'w-14 h-14 transition-transform select-none',
        item.isDragging ? 'z-50 scale-125 opacity-90' : 'z-10',
        item.isDangerous && 'animate-pulse'
      )}
      style={{
        left: `${item.x}px`,
        top: `${conveyorOffsetY + item.y}px`,
        backgroundColor: binInfo?.color || '#666',
        boxShadow: item.isDragging 
          ? '0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(255,255,255,0.3)'
          : '0 4px 15px rgba(0,0,0,0.3)',
        transform: item.isDragging ? 'rotate(-5deg)' : 'rotate(0deg)',
        transition: item.isDragging ? 'none' : 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <span className="text-3xl drop-shadow-lg">{item.emoji}</span>
      
      {item.isDangerous && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-lg animate-bounce">
          !
        </div>
      )}
      
      {item.isPolluted && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-xs shadow-lg">
          <span className="text-white">💧</span>
        </div>
      )}
      
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
    </div>
  );
};

export default WasteItemCard;

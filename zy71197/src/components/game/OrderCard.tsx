import React, { useState } from 'react';
import { Order, Mold } from '../../game/types';
import { Badge } from '../ui/Badge';
import { GripVertical, Clock, Calendar, AlertTriangle } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  mold?: Mold;
  index: number;
  isScheduled: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  mold,
  index,
  isScheduled,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(index);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(index);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(index);
  };

  return (
    <div
      draggable={!isScheduled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`bg-gray-700 rounded-lg p-3 mb-2 cursor-move transition-all duration-200 border-2 ${
        isDragging ? 'opacity-50 scale-105 border-blue-400' : 'border-transparent hover:border-gray-500'
      } ${isScheduled ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white text-sm truncate">{order.name}</span>
            {mold && (
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: mold.color }}
              />
            )}
          </div>
          
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {order.productionTime}分
            </span>
            
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {order.deadline}分
            </span>
            
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              ¥{order.delayPenalty}/分
            </span>
          </div>
        </div>

        <div className="flex-shrink-0">
          {mold && (
            <Badge variant="info" className="text-xs">
              {mold.name}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Pill, AlertTriangle, Calendar, Hash } from 'lucide-react';
import type { Medicine } from '@/types';
import { cn } from '@/lib/utils';

interface MedicineCardProps {
  medicine: Medicine;
  isDragging?: boolean;
  isPlaced?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  draggable?: boolean;
}

export const MedicineCard = memo(function MedicineCard({
  medicine,
  isDragging = false,
  isPlaced = false,
  onClick,
  onDragStart,
  onDragEnd,
  draggable = true
}: MedicineCardProps) {
  const isExpired = new Date(medicine.expiryDate) < new Date('2026-05-26');
  
  const categoryColors: Record<string, string> = {
    '抗生素': 'bg-blue-100 text-blue-800 border-blue-200',
    '解热镇痛': 'bg-orange-100 text-orange-800 border-orange-200',
    '降糖药': 'bg-green-100 text-green-800 border-green-200',
    '降压药': 'bg-purple-100 text-purple-800 border-purple-200',
    '消化系统': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    '呼吸系统': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    '心血管': 'bg-red-100 text-red-800 border-red-200',
    '抗过敏药': 'bg-pink-100 text-pink-800 border-pink-200',
    '维生素': 'bg-lime-100 text-lime-800 border-lime-200',
    '激素类': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    '精神类': 'bg-rose-100 text-rose-800 border-rose-200'
  };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e);
    }
  }, [onDragStart]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (onDragEnd) {
      onDragEnd(e);
    }
  }, [onDragEnd]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ 
        opacity: isDragging ? 0.5 : 1, 
        scale: isDragging ? 1.05 : isPlaced ? 0.95 : 1 
      }}
      whileHover={{ scale: draggable ? 1.02 : 1 }}
      whileTap={{ scale: draggable ? 0.98 : 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative w-48 rounded-xl border-2 bg-white shadow-md cursor-grab active:cursor-grabbing',
        'transition-all duration-200 select-none',
        isPlaced && 'ring-2 ring-blue-500 ring-offset-2',
        isExpired && 'border-red-400 bg-red-50',
        !draggable && 'cursor-default'
      )}
      draggable={draggable}
      onDragStart={handleDragStart as any}
      onDragEnd={handleDragEnd as any}
      onClick={onClick}
    >
      {isExpired && (
        <div className="absolute -top-2 -right-2 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
            <AlertTriangle size={12} />
            过期
          </span>
        </div>
      )}
      
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow">
              <Pill className="text-white" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm leading-tight">
                {medicine.name}
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                {medicine.genericName}
              </p>
            </div>
          </div>
        </div>
        
        <span className={cn(
          'inline-block px-2 py-0.5 text-xs font-medium rounded-full border mb-2',
          categoryColors[medicine.category] || 'bg-gray-100 text-gray-800 border-gray-200'
        )}>
          {medicine.category}
        </span>
        
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className="font-semibold text-gray-700">规格:</span>
            <span className="font-mono text-blue-600">{medicine.specification}</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-gray-600">
            <Hash size={12} className="text-gray-400" />
            <span className="font-semibold text-gray-700">批号:</span>
            <span className="font-mono">{medicine.batchNumber}</span>
          </div>
          
          <div className={cn(
            'flex items-center gap-1.5',
            isExpired ? 'text-red-600' : 'text-gray-600'
          )}>
            <Calendar size={12} className={isExpired ? 'text-red-500' : 'text-gray-400'} />
            <span className="font-semibold text-gray-700">效期:</span>
            <span className={cn('font-mono', isExpired && 'text-red-600 font-bold')}>
              {medicine.expiryDate}
            </span>
          </div>
        </div>
        
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {medicine.manufacturer}
          </p>
        </div>
      </div>
    </motion.div>
  );
});

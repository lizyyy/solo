import React from 'react';
import { motion } from 'framer-motion';
import { ChemicalCard } from './ChemicalCard';
import { useGameStore } from '../../store/useGameStore';
import { getChemicalById } from '../../data/chemicals';
import { useDragDrop } from '../../hooks/useDragDrop';
import { Package } from 'lucide-react';

export const ChemicalLibrary: React.FC = () => {
  const pendingChemicals = useGameStore(state => state.pendingChemicals);
  const placedChemicals = useGameStore(state => state.placedChemicals);

  const {
    handleDragStart,
    handleDragEnd,
    isDragging,
    draggingChemicalId
  } = useDragDrop();

  const pendingList = pendingChemicals
    .map(id => getChemicalById(id))
    .filter(Boolean);

  const placedList = placedChemicals
    .map(id => getChemicalById(id))
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex flex-col bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden"
    >
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Package className="w-5 h-5" />
          化学品库
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-yellow-400">
              待摆放 ({pendingList.length})
            </h4>
          </div>
          {pendingList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              所有化学品已摆放完成
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {pendingList.map(chemical => (
                <ChemicalCard
                  key={chemical!.id}
                  chemical={chemical!}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={isDragging && draggingChemicalId === chemical!.id}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-green-400">
              已摆放 ({placedList.length})
            </h4>
          </div>
          {placedList.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">
              拖拽化学品到货架
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {placedList.map(chemical => (
                <div
                  key={chemical!.id}
                  className="opacity-60"
                >
                  <ChemicalCard
                    chemical={chemical!}
                    onDragStart={() => {}}
                    onDragEnd={() => {}}
                    compact
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

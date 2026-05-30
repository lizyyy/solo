import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkSlot as WorkSlotType } from '../types';
import { NoteIcon } from './NoteIcon';

interface WorkSlotDroppableProps {
  slot: WorkSlotType;
  onRemove?: () => void;
}

export const WorkSlotDroppable: React.FC<WorkSlotDroppableProps> = ({ slot, onRemove }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: slot.id,
    data: {
      type: 'slot',
      slot,
    },
    disabled: slot.isFixed,
  });

  const getSlotClass = () => {
    if (slot.errorState) return 'work-slot-error';
    if (slot.assignedNote) return 'work-slot-success';
    if (isOver) return 'work-slot-active';
    return '';
  };

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`work-slot ${getSlotClass()} relative`}
      onClick={() => {
        if (slot.assignedNote && !slot.isFixed && onRemove) {
          onRemove();
        }
      }}
    >
      <AnimatePresence mode="wait">
        {slot.assignedNote ? (
          <motion.div
            key="note"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <NoteIcon type={slot.assignedNote.type} size={32} />
            <span className="text-xs mt-1 text-gear-500">
              {slot.assignedNote.duration}拍
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-gear-300 text-center"
          >
            <div className="text-2xl mb-1">+</div>
            <span className="text-xs">工位{slot.slotIndex + 1}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {slot.isFixed && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-factory-500 rounded-full flex items-center justify-center text-white text-xs">
          🔒
        </div>
      )}
    </motion.div>
  );
};

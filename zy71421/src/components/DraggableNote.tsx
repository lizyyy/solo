import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { NoteCard } from '../types';
import { NoteIcon } from './NoteIcon';

interface DraggableNoteProps {
  note: NoteCard;
  isDragging?: boolean;
}

export const DraggableNote: React.FC<DraggableNoteProps> = ({ note }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: note.id,
    data: {
      type: 'note',
      note,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.1 : 1})`,
    zIndex: isDragging ? 999 : 'auto',
  } : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: isDragging ? 0.8 : 1, 
        scale: isDragging ? 1.05 : 1,
        y: isDragging ? -5 : 0
      }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`note-card select-none ${
        isDragging ? 'shadow-2xl border-factory-500' : ''
      } ${note.isRest ? 'bg-gear-50' : 'bg-white'}`}
    >
      <NoteIcon type={note.type} size={36} />
      <span className={`text-xs mt-1 font-medium ${
        note.hasDot ? 'text-factory-600' : note.isRest ? 'text-gear-500' : 'text-gear-600'
      }`}>
        {note.name}
      </span>
      <span className="text-xs text-gear-400">
        {note.duration}拍
      </span>
    </motion.div>
  );
};

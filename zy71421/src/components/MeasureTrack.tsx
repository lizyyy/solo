import React from 'react';
import { motion } from 'framer-motion';
import { Measure } from '../types';
import { WorkSlotDroppable } from './WorkSlotDroppable';
import { useGameStore } from '../store/gameStore';
import { calculateMeasureBeats } from '../utils/validation';

interface MeasureTrackProps {
  measure: Measure;
  index: number;
}

export const MeasureTrack: React.FC<MeasureTrackProps> = ({ measure, index }) => {
  const removeNote = useGameStore(state => state.removeNote);
  const currentBeats = calculateMeasureBeats(measure.slots);
  const isComplete = currentBeats === measure.targetBeats;
  const isOverflow = currentBeats > measure.targetBeats;

  if (!measure.isLoaded) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        className="factory-card p-4 mb-4"
      >
        <div className="h-32 bg-gear-100 rounded-xl animate-pulse" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 100, damping: 20 }}
      className={`factory-card p-4 mb-4 ${
        isOverflow ? 'border-red-400' : isComplete ? 'border-green-400' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg text-factory-700">
            第 {index + 1} 小节
          </span>
          {isComplete && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-green-500 text-lg"
            >
              ✓
            </motion.span>
          )}
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          isOverflow 
            ? 'bg-red-100 text-red-600' 
            : isComplete 
              ? 'bg-green-100 text-green-600'
              : 'bg-gear-100 text-gear-600'
        }`}>
          {currentBeats} / {measure.targetBeats} 拍
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gear-50 to-factory-50 rounded-xl border border-gear-200">
        <div className="flex gap-3 flex-wrap">
          {measure.slots.map((slot) => (
            <WorkSlotDroppable
              key={slot.id}
              slot={slot}
              onRemove={() => removeNote(slot.id)}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-16 rounded ${
            isOverflow 
              ? 'bg-red-400' 
              : isComplete 
                ? 'bg-green-400' 
                : 'bg-gear-300'
          }`} 
          style={{ height: `${(currentBeats / measure.targetBeats) * 64}px` }}
          />
          <span className="text-xs text-gear-500">节拍</span>
        </div>
      </div>
    </motion.div>
  );
};

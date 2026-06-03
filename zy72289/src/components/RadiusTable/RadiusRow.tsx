import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import type { SafetyRadiusEntry } from '@/types';

interface RadiusRowProps {
  entry: SafetyRadiusEntry;
  isHighlighted: boolean;
}

export function RadiusRow({ entry, isHighlighted }: RadiusRowProps) {
  const hasConflict = entry.hasConflict || entry.oldRadius !== entry.newRadius;

  return (
    <motion.tr
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`
        border-b border-primary-700/30 text-xs
        ${isHighlighted ? 'bg-status-conflict/10' : 'hover:bg-primary-700/20'}
        transition-colors duration-200
      `}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {entry.isCurrent ? (
            <CheckCircle size={12} className="text-status-normal" />
          ) : (
            <div className="w-3 h-3 rounded-full bg-gray-600" />
          )}
          <span className="text-white font-mono">{entry.deviceId}</span>
        </div>
      </td>

      <td className="px-3 py-2 text-white">{entry.deviceName}</td>

      <td className="px-3 py-2">
        <span className="px-2 py-0.5 rounded bg-primary-700/50 text-primary-200 font-mono text-[10px]">
          {entry.voltageLevel}
        </span>
      </td>

      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono ${
              hasConflict ? 'text-status-conflict line-through' : 'text-gray-400'
            }`}
          >
            {entry.oldRadius}m
          </span>
          {hasConflict && (
            <ArrowRight size={12} className="text-gray-500" />
          )}
        </div>
      </td>

      <td className="px-3 py-2">
        <span
          className={`font-mono font-semibold ${
            hasConflict ? 'text-status-normal' : 'text-white'
          }`}
        >
          {entry.newRadius}m
        </span>
      </td>

      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-mono">{entry.version}</span>
          {hasConflict && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <AlertTriangle size={12} className="text-status-pending" />
            </motion.div>
          )}
        </div>
      </td>

      <td className="px-3 py-2 text-gray-400 font-mono text-[10px]">
        {entry.effectiveDate}
      </td>
    </motion.tr>
  );
}

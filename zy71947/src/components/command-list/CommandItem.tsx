import React, { useCallback, forwardRef } from 'react';
import { motion } from 'framer-motion';
import type { Command } from '../../types';
import { useSequenceStore } from '../../store/useSequenceStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { TimeService } from '../../services/timeService';
import { AnomalyDetector } from '../../services/anomalyDetector';
import { payloadColors, commandTypeLabels } from '../../mock/sampleData';
import {
  AlertTriangle,
  Zap,
  AlertOctagon,
  Clock,
  ChevronRight,
} from 'lucide-react';

interface CommandItemProps {
  command: Command;
  isAffected: boolean;
  format: 'UTC' | 'BEIJING' | 'RELATIVE';
}

export const CommandItem = forwardRef<HTMLDivElement, CommandItemProps>(({ command, isAffected, format }, ref) => {
  const { selectCommand, selectedCommandId } = useSequenceStore();
  const { setCurrentTime, showContextMenu } = usePlaybackStore();

  const isSelected = selectedCommandId === command.id;
  const payloadColor = payloadColors[command.payloadName] || '#64ffda';

  const getAnomalyIcon = () => {
    if (!command.anomaly) return null;
    switch (command.anomaly.anomalyType) {
      case 'WINDOW_OVERLAP':
        return <AlertOctagon className="w-3.5 h-3.5 text-cyber-red" />;
      case 'TELEMETRY_MISSING':
        return <AlertTriangle className="w-3.5 h-3.5 text-cyber-yellow" />;
      case 'MANUAL_INSERT':
        return <Zap className="w-3.5 h-3.5 text-cyber-purple" />;
      default:
        return null;
    }
  };

  const getAnomalyBadge = () => {
    if (!command.anomaly) return null;
    const color = AnomalyDetector.getAnomalyColor(command.anomaly.anomalyType);
    const label = AnomalyDetector.getAnomalyLabel(command.anomaly.anomalyType);
    return (
      <span
        className="px-1.5 py-0.5 text-[9px] font-mono rounded"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {label}
      </span>
    );
  };

  const handleClick = useCallback(() => {
    selectCommand(command.id);
    setCurrentTime(command.time.relativeSeconds);
  }, [command.id, command.time.relativeSeconds, selectCommand, setCurrentTime]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      selectCommand(command.id);
      if (command.isManualInsert || command.adjustments.length > 0) {
        showContextMenu(e.clientX, e.clientY, command.id);
      }
    },
    [command.id, command.isManualInsert, command.adjustments.length, selectCommand, showContextMenu]
  );

  const timeLabel = TimeService.formatByTimeFormat(command.time, format);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: 1,
        x: 0,
        boxShadow: isAffected ? '0 0 15px rgba(168, 85, 247, 0.4)' : undefined,
      }}
      transition={{ duration: 0.2 }}
      className={`p-3 rounded cursor-pointer transition-all border-l-2 ${
        isSelected
          ? 'bg-cyber-cyan/10 border-cyber-cyan'
          : 'bg-space-800/50 border-transparent hover:bg-space-700/50'
      } ${isAffected ? 'animate-pulse' : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-1 h-8 rounded-full flex-shrink-0 mt-1"
          style={{ backgroundColor: payloadColor }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className="text-xs font-medium truncate"
              style={{ color: payloadColor }}
            >
              {command.commandName}
            </span>
            <ChevronRight
              className={`w-4 h-4 flex-shrink-0 transition-transform ${
                isSelected ? 'text-cyber-cyan rotate-90' : 'text-gray-500'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-gray-500 font-mono">
              {command.payloadName}
            </span>
            <span className="w-1 h-1 rounded-full bg-space-600" />
            <span className="text-[10px] text-gray-500">
              {commandTypeLabels[command.commandType]}
            </span>
            {getAnomalyBadge()}
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            <div className="flex items-center gap-1 text-gray-400">
              <Clock className="w-3 h-3" />
              <span className="font-time">{timeLabel}</span>
            </div>
            <span className="text-gray-600">|</span>
            <span className="text-gray-500">
              时长: {TimeService.formatDuration(command.durationSeconds)}
            </span>
            {command.anomaly && (
              <>
                <span className="text-gray-600">|</span>
                {getAnomalyIcon()}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

CommandItem.displayName = 'CommandItem';

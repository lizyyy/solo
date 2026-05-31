import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Command, TimeFormat } from '../../types';
import { useSequenceStore } from '../../store/useSequenceStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { TimeService } from '../../services/timeService';
import { payloadColors, commandTypeLabels } from '../../mock/sampleData';
import { AlertTriangle, Zap, AlertOctagon, Clock } from 'lucide-react';

interface CommandBlockProps {
  command: Command;
  x: number;
  width: number;
  y: number;
  height: number;
  primaryFormat: TimeFormat;
  isAffected: boolean;
}

export const CommandBlock: React.FC<CommandBlockProps> = ({
  command,
  x,
  width,
  y,
  height,
  primaryFormat,
  isAffected,
}) => {
  const { selectCommand, selectedCommandId } = useSequenceStore();
  const { showContextMenu } = usePlaybackStore();

  const isSelected = selectedCommandId === command.id;
  const payloadColor = payloadColors[command.payloadName] || '#64ffda';

  const getAnomalyClass = () => {
    if (!command.anomaly) return '';
    switch (command.anomaly.anomalyType) {
      case 'WINDOW_OVERLAP':
        return 'anomaly-overlap';
      case 'TELEMETRY_MISSING':
        return 'anomaly-missing';
      case 'MANUAL_INSERT':
        return 'anomaly-manual';
      default:
        return '';
    }
  };

  const getAnomalyIcon = () => {
    if (!command.anomaly) return null;
    switch (command.anomaly.anomalyType) {
      case 'WINDOW_OVERLAP':
        return <AlertOctagon className="w-3 h-3 text-cyber-red" />;
      case 'TELEMETRY_MISSING':
        return <AlertTriangle className="w-3 h-3 text-cyber-yellow" />;
      case 'MANUAL_INSERT':
        return <Zap className="w-3 h-3 text-cyber-purple" />;
      default:
        return null;
    }
  };

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectCommand(command.id);
    },
    [command.id, selectCommand]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      selectCommand(command.id);
      if (command.isManualInsert || command.adjustments.length > 0) {
        showContextMenu(e.clientX, e.clientY, command.id);
      }
    },
    [command.id, command.isManualInsert, command.adjustments.length, selectCommand, showContextMenu]
  );

  const timeLabel = TimeService.formatByTimeFormat(command.time, primaryFormat);

  const minWidth = 40;
  const displayWidth = Math.max(width, minWidth);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
        x,
        y,
        boxShadow: isAffected ? '0 0 20px rgba(168, 85, 247, 0.8)' : undefined,
      }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
      className={`absolute cursor-pointer rounded-sm overflow-hidden border transition-all duration-200
        ${getAnomalyClass()}
        ${isSelected ? 'ring-2 ring-cyber-cyan z-20' : 'hover:brightness-110 z-10'}
        ${isAffected ? 'animate-pulse' : ''}
      `}
      style={{
        width: displayWidth,
        height,
        backgroundColor: `${payloadColor}15`,
        borderColor: `${payloadColor}80`,
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: payloadColor }}
      />

      <div className="p-1 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {command.anomaly && (
              <span className="flex-shrink-0">{getAnomalyIcon()}</span>
            )}
            <span
              className="text-[10px] font-mono truncate font-medium"
              style={{ color: payloadColor }}
            >
              {command.commandName}
            </span>
          </div>
          {command.isManualInsert && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-cyber-purple" />
          )}
        </div>

        {width > 80 && (
          <div className="text-[9px] text-gray-400 font-time truncate">
            {timeLabel}
          </div>
        )}

        {width > 100 && (
          <div className="flex items-center gap-1 text-[9px] text-gray-500">
            <Clock className="w-2 h-2" />
            <span className="font-mono">
              {commandTypeLabels[command.commandType]}
            </span>
          </div>
        )}
      </div>

      {isSelected && (
        <motion.div
          layoutId="command-selection"
          className="absolute inset-0 border-2 border-cyber-cyan rounded-sm pointer-events-none"
          style={{ boxShadow: '0 0 15px rgba(100, 255, 218, 0.5)' }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  );
};

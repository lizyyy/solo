import React from 'react';
import { motion } from 'framer-motion';
import type { TimeFormat, TimeWindow } from '../../types';
import { TimeService } from '../../services/timeService';

interface TimeAxisProps {
  format: TimeFormat;
  ticks: { value: number; label: string }[];
  height: number;
  width: number;
  windows: TimeWindow[];
  getXPosition: (time: number) => number;
  isPrimary: boolean;
}

const formatLabels: Record<TimeFormat, string> = {
  UTC: 'UTC 时间',
  BEIJING: '北京时',
  RELATIVE: '相对任务时',
};

export const TimeAxis: React.FC<TimeAxisProps> = ({
  format,
  ticks,
  height,
  width,
  windows,
  getXPosition,
  isPrimary,
}) => {
  return (
    <div
      className={`relative border-b border-space-600/50 ${
        isPrimary ? 'bg-space-800/60' : 'bg-space-900/30'
      }`}
      style={{ height }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-20 flex items-center px-2 border-r border-space-600/50 bg-space-800/80 z-10">
        <span
          className={`text-xs font-mono ${
            isPrimary ? 'text-cyber-cyan font-bold' : 'text-gray-400'
          }`}
        >
          {formatLabels[format]}
        </span>
      </div>

      <div className="ml-20 relative h-full overflow-hidden">
        {windows.map(window => {
          const startX = getXPosition(window.startTime.relativeSeconds);
          const endX = getXPosition(window.endTime.relativeSeconds);
          const windowWidth = endX - startX;

          if (windowWidth < 0) return null;

          return (
            <motion.div
              key={window.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-2 bottom-2 rounded-sm border border-cyber-cyan/20"
              style={{
                left: startX,
                width: windowWidth,
                background: 'linear-gradient(180deg, rgba(100, 255, 218, 0.1) 0%, rgba(100, 255, 218, 0.02) 100%)',
              }}
            >
              {windowWidth > 80 && (
                <span className="absolute top-1 left-2 text-[10px] text-cyber-cyan/60 font-mono truncate" style={{ width: windowWidth - 20 }}>
                  {window.name}
                </span>
              )}
            </motion.div>
          );
        })}

        {ticks.map((tick, index) => {
          const x = getXPosition(tick.value);
          return (
            <div
              key={index}
              className="absolute top-0 bottom-0 flex flex-col items-center"
              style={{ left: x }}
            >
              <div
                className={`w-px ${
                  isPrimary ? 'bg-cyber-cyan/40' : 'bg-space-500/30'
                }`}
                style={{ height: '100%' }}
              />
              <span
                className={`absolute top-1 text-[10px] font-time whitespace-nowrap -translate-x-1/2 ${
                  isPrimary ? 'text-cyber-cyan' : 'text-gray-500'
                }`}
              >
                {format === 'RELATIVE'
                  ? TimeService.formatRelative(tick.value)
                  : tick.label.split(' ')[1]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

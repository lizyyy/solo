import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TimeFormat } from '../../types';
import { useSequenceStore } from '../../store/useSequenceStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useTimeline } from '../../hooks/useTimeline';
import { usePlayback } from '../../hooks/usePlayback';
import { TimeAxis } from './TimeAxis';
import { CommandBlock } from './CommandBlock';
import { TimeService } from '../../services/timeService';
import { ZoomIn, ZoomOut, Move } from 'lucide-react';

const AXIS_HEIGHT = 50;
const COMMAND_ROW_HEIGHT = 40;
const PADDING_TOP = 10;

export const Timeline: React.FC = () => {
  const { sequence, selectedCommandId, affectedCommandIds, selectCommand, isRecalculating } =
    useSequenceStore();
  const {
    primaryTimeFormat,
    currentTime,
    startTime,
    endTime,
    zoom,
    pan,
    setZoom,
    setPan,
    setCurrentTime,
    hideContextMenu,
  } = usePlaybackStore();

  usePlayback();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartPan, setDragStartPan] = useState(0);

  const timeline = useTimeline(startTime, endTime, zoom, pan, containerWidth);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 80);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const secondaryFormats: TimeFormat[] = ['UTC', 'BEIJING', 'RELATIVE'].filter(
    f => f !== primaryTimeFormat
  ) as TimeFormat[];

  const payloads = [...new Set(sequence.commands.map(c => c.payloadName))];

  const getCommandPosition = (cmd: typeof sequence.commands[0]) => {
    const payloadIndex = payloads.indexOf(cmd.payloadName);
    const y = PADDING_TOP + payloadIndex * COMMAND_ROW_HEIGHT;
    const x = timeline.getXPosition(cmd.time.relativeSeconds);
    const width = timeline.getWidth(cmd.durationSeconds);
    return { x, y, width };
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || e.altKey) {
        e.preventDefault();
        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartPan(pan);
        document.body.style.cursor = 'grabbing';
      }
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        const panDelta = -deltaX / containerWidth / zoom;
        const newPan = Math.max(0, Math.min(1 - 1 / zoom, dragStartPan + panDelta));
        setPan(newPan);
      }
    },
    [isDragging, dragStartX, dragStartPan, containerWidth, zoom, setPan]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(Math.max(0.5, Math.min(5, zoom + delta)));
    },
    [zoom, setZoom]
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left - 80;
      const time = timeline.getTimeFromX(x);
      setCurrentTime(Math.max(startTime, Math.min(endTime, time)));
      selectCommand(null);
      hideContextMenu();
    },
    [isDragging, timeline, startTime, endTime, setCurrentTime, selectCommand, hideContextMenu]
  );

  const indicatorX = timeline.getXPosition(currentTime);
  const totalHeight = PADDING_TOP + payloads.length * COMMAND_ROW_HEIGHT + 20;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-space-600/50 bg-space-800/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">缩放:</span>
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="p-1 hover:bg-space-700 rounded transition-colors"
            >
              <ZoomOut className="w-4 h-4 text-gray-400" />
            </button>
            <span className="text-xs text-cyber-cyan font-mono w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(5, zoom + 0.25))}
              className="p-1 hover:bg-space-700 rounded transition-colors"
            >
              <ZoomIn className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Move className="w-3 h-3" />
            <span>Alt+拖动平移 | 滚轮缩放 | 点击定位</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">当前时间:</span>
          <span className="text-sm font-mono text-cyber-cyan">
            {TimeService.formatRelative(currentTime)}
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative timeline-grid cursor-crosshair scan-line"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleTimelineClick}
        style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
      >
        <AnimatePresence>
          {isRecalculating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-space-900/80 flex items-center justify-center z-50"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-cyber-cyan/30 border-t-cyber-cyan rounded-full animate-spin" />
                <span className="text-cyber-cyan font-mono">正在重算序列...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <TimeAxis
            format={primaryTimeFormat}
            ticks={timeline.getTicks(primaryTimeFormat)}
            height={AXIS_HEIGHT}
            width={containerWidth}
            windows={sequence.windows}
            getXPosition={timeline.getXPosition}
            isPrimary={true}
          />

          {secondaryFormats.map(format => (
            <TimeAxis
              key={format}
              format={format}
              ticks={timeline.getTicks(format)}
              height={AXIS_HEIGHT * 0.6}
              width={containerWidth}
              windows={sequence.windows}
              getXPosition={timeline.getXPosition}
              isPrimary={false}
            />
          ))}
        </div>

        <div className="relative" style={{ height: totalHeight, width: containerWidth + 80 }}>
          <div className="absolute left-0 w-20 h-full border-r border-space-600/50 bg-space-800/80 z-10">
            {payloads.map((payload, index) => (
              <div
                key={payload}
                className="flex items-center px-2 text-[10px] text-gray-400 font-mono border-b border-space-600/30"
                style={{ height: COMMAND_ROW_HEIGHT, marginTop: index === 0 ? PADDING_TOP : 0 }}
              >
                <span className="truncate">{payload}</span>
              </div>
            ))}
          </div>

          <div className="ml-20 relative" style={{ height: totalHeight }}>
            {payloads.map((_, index) => (
              <div
                key={index}
                className="absolute left-0 right-0 border-b border-space-700/30"
                style={{
                  top: PADDING_TOP + index * COMMAND_ROW_HEIGHT,
                  height: COMMAND_ROW_HEIGHT,
                }}
              />
            ))}

            {sequence.commands.map(cmd => {
              const pos = getCommandPosition(cmd);
              if (!timeline.isInView(cmd.time.relativeSeconds, cmd.time.relativeSeconds + cmd.durationSeconds)) {
                return null;
              }

              const isAffected = affectedCommandIds.includes(cmd.id);

              return (
                <CommandBlock
                  key={cmd.id}
                  command={cmd}
                  x={pos.x}
                  y={pos.y}
                  width={pos.width}
                  height={COMMAND_ROW_HEIGHT - 4}
                  primaryFormat={primaryTimeFormat}
                  isAffected={isAffected}
                />
              );
            })}

            <motion.div
              className="absolute top-0 bottom-0 w-0.5 bg-cyber-cyan z-30 pointer-events-none"
              style={{
                left: 80 + indicatorX,
                boxShadow: '0 0 10px rgba(100, 255, 218, 0.8)',
              }}
              animate={{ left: 80 + indicatorX }}
              transition={{ duration: 0.1, ease: 'linear' }}
            >
              <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-cyber-cyan rounded-full" />
              <div className="absolute -bottom-1 -left-1.5 w-3 h-3 bg-cyber-cyan rounded-full" />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

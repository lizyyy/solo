import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useTimeline } from '../hooks/useTimeline';
import { formatTime } from '../utils/time';
import type { VisibilityWindow, ScheduleBlock } from '../types/mission';

interface TimelineProps {
  onBlockClick?: (block: ScheduleBlock) => void;
  onWindowClick?: (window: VisibilityWindow) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ onBlockClick, onWindowClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  
  const { 
    visibilityWindows, 
    groundStations, 
    currentTime,
    status,
    dataPackets,
    commands,
  } = useGameStore();
  
  const { blocks } = useScheduleStore();

  const startTime = visibilityWindows.length > 0 
    ? Math.min(...visibilityWindows.map(w => w.startTime)) - 60000 
    : 0;
  const endTime = visibilityWindows.length > 0 
    ? Math.max(...visibilityWindows.map(w => w.endTime)) + 60000 
    : 0;

  const timeline = useTimeline(containerRef, startTime, endTime, width);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const stationRows = groundStations.map(station => ({
    station,
    windows: visibilityWindows.filter(w => w.groundStationId === station.id),
  }));

  const timeMarkers = [];
  const markerInterval = Math.ceil((endTime - startTime) / 6 / 60000) * 60000;
  for (let t = startTime; t <= endTime; t += markerInterval) {
    timeMarkers.push(t);
  }

  const currentX = timeline.timeToX(currentTime);
  
  const conflicts = useMemo(() => {
    if (!timeline.selectedBlockId) return [];
    const selectedBlock = blocks.find(b => b.id === timeline.selectedBlockId);
    if (!selectedBlock) return [];
    return timeline.getConflicts(selectedBlock);
  }, [timeline.selectedBlockId, blocks, timeline]);

  return (
    <div className="bg-deep-900 rounded-lg border border-deep-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-deep-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gold-400 font-mono">任务时间轴</h3>
        <div className="flex items-center gap-4 text-xs text-deep-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-600 rounded-sm" />
            数据下载
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-blue-600 rounded-sm" />
            指令发送
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 border-2 border-blue-500 rounded-sm bg-blue-500/20" />
            可见窗口
          </span>
        </div>
      </div>

      <div className="relative" ref={containerRef} style={{ height: '320px' }}>
        <div className="absolute top-0 left-0 right-0 h-8 border-b border-deep-700 bg-deep-800/50">
          {timeMarkers.map((time, index) => (
            <div
              key={index}
              className="absolute top-0 h-full border-l border-deep-700"
              style={{ left: `${timeline.timeToX(time)}px` }}
            >
              <span className="absolute top-1 left-1 text-xs text-deep-400 font-mono">
                {formatTime(time)}
              </span>
            </div>
          ))}
        </div>

        {currentTime > startTime && currentTime < endTime && (
          <motion.div
            className="absolute top-0 bottom-0 w-px bg-red-500 z-20"
            style={{ left: `${currentX}px` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <div className="absolute -top-1 -left-2 w-4 h-2 bg-red-500" 
                 style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
          </motion.div>
        )}

        <div className="absolute top-8 left-0 right-0 bottom-0 overflow-y-auto">
          {stationRows.map(({ station, windows }, rowIndex) => (
            <div key={station.id} className="flex border-b border-deep-700 h-16">
              <div className="w-32 flex-shrink-0 border-r border-deep-700 px-3 py-2 bg-deep-800/30">
                <div className="text-xs font-mono text-gold-400">{station.name}</div>
                <div className="text-[10px] text-deep-500">{station.latitude.toFixed(1)}°, {station.longitude.toFixed(1)}°</div>
              </div>

              <div className="flex-1 relative">
                {windows.map(window => (
                  <div
                    key={window.id}
                    className="absolute top-1 bottom-1 rounded cursor-pointer transition-all hover:opacity-80"
                    style={timeline.getWindowStyle(window)}
                    onClick={() => onWindowClick?.(window)}
                  >
                    {window.status === 'missed' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      </div>
                    )}
                    {window.status === 'active' && (
                      <motion.div
                        className="absolute inset-0 bg-green-500/10"
                        animate={{ opacity: [0, 0.5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>
                ))}

                {blocks
                  .filter(b => b.stationId === station.id)
                  .map(block => {
                    const blockConflicts = timeline.getConflicts(block);
                    const hasConflict = blockConflicts.length > 0;
                    const tasks = block.taskIds.map(id => 
                      dataPackets.find(p => p.id === id)?.dataType ||
                      commands.find(c => c.id === id)?.name ||
                      '未知'
                    );

                    return (
                      <div
                        key={block.id}
                        className={`absolute top-3 bottom-3 rounded px-2 py-1 cursor-move
                          ${hasConflict ? 'ring-2 ring-red-500' : ''}
                          ${timeline.selectedBlockId === block.id ? 'ring-2 ring-gold-500' : ''}`}
                        style={timeline.getBlockStyle(block)}
                        onMouseDown={(e) => timeline.handleBlockMouseDown(e, block.id)}
                        onMouseEnter={(e) => timeline.handleBlockHover(block.id, e)}
                        onMouseLeave={() => timeline.handleBlockHover(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBlockClick?.(block);
                        }}
                      >
                        {block.taskIds.length > 1 && (
                          <span className="absolute top-0 left-1 text-[10px] font-mono bg-black/50 px-1 rounded">
                            {block.taskIds.length}
                          </span>
                        )}
                        
                        <div className="text-[10px] font-mono truncate">
                          {tasks[0]}
                          {block.taskIds.length > 1 && '...'}
                        </div>

                        {status !== 'running' && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-r"
                            onMouseDown={(e) => timeline.handleResizeMouseDown(e, block.id)}
                          />
                        )}

                        {timeline.hoveredBlockId === block.id && status !== 'running' && (
                          <button
                            className="absolute -right-6 top-1/2 -translate-y-1/2 p-1 bg-red-600 rounded hover:bg-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              timeline.handleDeleteBlock(block.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {timeline.tooltip && (
          <div
            className="fixed z-50 bg-deep-800 border border-deep-600 rounded px-3 py-2 text-xs font-mono whitespace-pre-line pointer-events-none"
            style={{ left: timeline.tooltip.x, top: timeline.tooltip.y }}
          >
            {timeline.tooltip.content}
          </div>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-800 text-xs text-red-300">
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          检测到调度冲突：与 {conflicts.length} 个任务块存在时间重叠
        </div>
      )}
    </div>
  );
};



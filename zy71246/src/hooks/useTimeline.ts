import { useState, useRef, useCallback, useEffect } from 'react';
import { useScheduleStore } from '../store/scheduleStore';
import { useGameStore } from '../store/gameStore';
import type { ScheduleBlock, VisibilityWindow, GroundStation } from '../types/mission';
import { hasConflict } from '../engine/timelineEngine';

interface DragState {
  isDragging: boolean;
  blockId: string | null;
  startX: number;
  startTime: number;
}

interface ResizeState {
  isResizing: boolean;
  blockId: string | null;
  startX: number;
  startEndTime: number;
}

export function useTimeline(
  containerRef: React.RefObject<HTMLDivElement>,
  startTime: number,
  endTime: number,
  width: number
) {
  const { 
    blocks, 
    selectedBlockId, 
    selectBlock,
    moveBlock,
    resizeBlock,
    removeBlock,
    getBlocksForStation,
  } = useScheduleStore();
  
  const { visibilityWindows, groundStations, status } = useGameStore();

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    blockId: null,
    startX: 0,
    startTime: 0,
  });

  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    blockId: null,
    startX: 0,
    startEndTime: 0,
  });

  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const timeToX = useCallback((time: number) => {
    const duration = endTime - startTime;
    if (duration === 0) return 0;
    return ((time - startTime) / duration) * width;
  }, [startTime, endTime, width]);

  const xToTime = useCallback((x: number) => {
    const duration = endTime - startTime;
    return startTime + (x / width) * duration;
  }, [startTime, endTime, width]);

  const getBlockStyle = useCallback((block: ScheduleBlock) => {
    const left = timeToX(block.startTime);
    const right = timeToX(block.endTime);
    const blockWidth = Math.max(4, right - left);

    const station = groundStations.find(s => s.id === block.stationId);
    const window = visibilityWindows.find(w => w.id === block.windowId);
    
    let bgColor = block.type === 'download' ? '#27ae60' : '#3498db';
    if (block.id === selectedBlockId) {
      bgColor = block.type === 'download' ? '#2ecc71' : '#3498db';
    }

    return {
      left: `${left}px`,
      width: `${blockWidth}px`,
      backgroundColor: bgColor,
      opacity: status === 'running' ? 0.9 : 1,
    };
  }, [timeToX, groundStations, visibilityWindows, selectedBlockId, status]);

  const getWindowStyle = useCallback((window: VisibilityWindow) => {
    const left = timeToX(window.startTime);
    const right = timeToX(window.endTime);
    const windowWidth = Math.max(2, right - left);

    let bgColor = 'rgba(52, 152, 219, 0.2)';
    let borderColor = '#3498db';
    
    if (window.status === 'active') {
      bgColor = 'rgba(39, 174, 96, 0.3)';
      borderColor = '#27ae60';
    } else if (window.status === 'missed') {
      bgColor = 'rgba(231, 76, 60, 0.2)';
      borderColor = '#e74c3c';
    } else if (window.status === 'completed') {
      bgColor = 'rgba(46, 204, 113, 0.15)';
      borderColor = '#2ecc71';
    }

    return {
      left: `${left}px`,
      width: `${windowWidth}px`,
      backgroundColor: bgColor,
      borderLeft: `2px solid ${borderColor}`,
      borderRight: `2px solid ${borderColor}`,
    };
  }, [timeToX]);

  const getConflicts = useCallback((block: ScheduleBlock) => {
    const station = groundStations.find(s => s.id === block.stationId);
    if (!station) return [];
    
    return blocks.filter(b => 
      b.id !== block.id && 
      b.stationId === block.stationId && 
      hasConflict(b, block, station.antennaSlewTime)
    );
  }, [blocks, groundStations]);

  const handleBlockMouseDown = useCallback((e: React.MouseEvent, blockId: string) => {
    if (status === 'running') return;
    
    e.stopPropagation();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    selectBlock(blockId);
    setDragState({
      isDragging: true,
      blockId,
      startX: e.clientX,
      startTime: block.startTime,
    });
  }, [status, blocks, selectBlock]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, blockId: string) => {
    if (status === 'running') return;
    
    e.stopPropagation();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    setResizeState({
      isResizing: true,
      blockId,
      startX: e.clientX,
      startEndTime: block.endTime,
    });
  }, [status, blocks]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragState.isDragging && dragState.blockId) {
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = (deltaX / width) * (endTime - startTime);
      const newStartTime = dragState.startTime + deltaTime;
      
      moveBlock(dragState.blockId, newStartTime);
    }

    if (resizeState.isResizing && resizeState.blockId) {
      const deltaX = e.clientX - resizeState.startX;
      const deltaTime = (deltaX / width) * (endTime - startTime);
      const newEndTime = resizeState.startEndTime + deltaTime;
      
      resizeBlock(resizeState.blockId, newEndTime);
    }
  }, [dragState, resizeState, width, endTime, startTime, moveBlock, resizeBlock]);

  const handleMouseUp = useCallback(() => {
    setDragState({ isDragging: false, blockId: null, startX: 0, startTime: 0 });
    setResizeState({ isResizing: false, blockId: null, startX: 0, startEndTime: 0 });
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      selectBlock(null);
    }
  }, [containerRef, selectBlock]);

  const handleBlockHover = useCallback((blockId: string | null, e?: React.MouseEvent) => {
    setHoveredBlockId(blockId);
    
    if (blockId && e) {
      const block = blocks.find(b => b.id === blockId);
      if (block) {
        const station = groundStations.find(s => s.id === block.stationId);
        const content = `${block.type === 'download' ? '数据下载' : '指令发送'}\n站点: ${station?.name || '未知'}\n任务数: ${block.taskIds.length}`;
        setTooltip({
          x: e.clientX + 10,
          y: e.clientY + 10,
          content,
        });
      }
    } else {
      setTooltip(null);
    }
  }, [blocks, groundStations]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    if (status === 'running') return;
    removeBlock(blockId);
  }, [status, removeBlock]);

  useEffect(() => {
    if (dragState.isDragging || resizeState.isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mouseleave', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mouseleave', handleMouseUp);
      };
    }
  }, [dragState.isDragging, resizeState.isResizing, handleMouseMove, handleMouseUp]);

  return {
    timeToX,
    xToTime,
    getBlockStyle,
    getWindowStyle,
    getConflicts,
    handleBlockMouseDown,
    handleResizeMouseDown,
    handleContainerClick,
    handleBlockHover,
    handleDeleteBlock,
    hoveredBlockId,
    tooltip,
    selectedBlockId,
    isDragging: dragState.isDragging,
    isResizing: resizeState.isResizing,
  };
}

import type { VisibilityWindow, ScheduleBlock, GroundStation } from '../types/mission';
import { generateId } from '../utils/time';

export function canScheduleTask(
  window: VisibilityWindow,
  taskType: 'download' | 'command',
  dataSize: number,
  bandwidth: number
): boolean {
  const requiredTime = (dataSize * 8) / (bandwidth * 1024) * 1000;
  return requiredTime <= (window.endTime - window.startTime);
}

export function hasConflict(
  block1: ScheduleBlock,
  block2: ScheduleBlock,
  slewTime: number
): boolean {
  const adjustedStart = block2.startTime - slewTime * 1000;
  return block1.endTime > adjustedStart && block1.startTime < block2.endTime;
}

export function findConflicts(
  blocks: ScheduleBlock[],
  newBlock: ScheduleBlock,
  slewTime: number
): ScheduleBlock[] {
  return blocks.filter(b => b.id !== newBlock.id && hasConflict(b, newBlock, slewTime));
}

export function createScheduleBlock(
  window: VisibilityWindow,
  type: 'download' | 'command',
  taskIds: string[],
  startTime: number,
  duration: number
): ScheduleBlock {
  return {
    id: generateId(),
    windowId: window.id,
    stationId: window.groundStationId,
    startTime,
    endTime: startTime + duration,
    type,
    taskIds,
  };
}

export function getBlocksForStation(
  blocks: ScheduleBlock[],
  stationId: string
): ScheduleBlock[] {
  return blocks
    .filter(b => b.stationId === stationId)
    .sort((a, b) => a.startTime - b.startTime);
}

export function getBlocksForWindow(
  blocks: ScheduleBlock[],
  windowId: string
): ScheduleBlock[] {
  return blocks.filter(b => b.windowId === windowId);
}

export function getActiveBlock(
  blocks: ScheduleBlock[],
  currentTime: number
): ScheduleBlock | null {
  return blocks.find(b => b.startTime <= currentTime && b.endTime > currentTime) || null;
}

export function getUpcomingBlocks(
  blocks: ScheduleBlock[],
  currentTime: number,
  lookAhead: number = 5 * 60 * 1000
): ScheduleBlock[] {
  return blocks
    .filter(b => b.startTime > currentTime && b.startTime <= currentTime + lookAhead)
    .sort((a, b) => a.startTime - b.startTime);
}

export function calculateRequiredTime(
  dataSize: number,
  bandwidth: number
): number {
  return (dataSize * 8) / (bandwidth * 1024) * 1000;
}

export function canFitInWindow(
  blocks: ScheduleBlock[],
  window: VisibilityWindow,
  newBlockStart: number,
  newBlockDuration: number,
  station: GroundStation
): boolean {
  const newBlockEnd = newBlockStart + newBlockDuration;
  
  if (newBlockStart < window.startTime || newBlockEnd > window.endTime) {
    return false;
  }
  
  const stationBlocks = getBlocksForStation(blocks, station.id);
  const testBlock: ScheduleBlock = {
    id: 'test',
    windowId: window.id,
    stationId: station.id,
    startTime: newBlockStart,
    endTime: newBlockEnd,
    type: 'download',
    taskIds: [],
  };
  
  const conflicts = findConflicts(stationBlocks, testBlock, station.antennaSlewTime);
  return conflicts.length === 0;
}

import { create } from 'zustand';
import type { ScheduleBlock, VisibilityWindow, GroundStation, DataPacket, Command } from '../types/mission';
import { 
  canScheduleTask, 
  findConflicts, 
  createScheduleBlock,
  calculateRequiredTime,
  canFitInWindow,
} from '../engine/timelineEngine';
import { generateId } from '../utils/time';
import { calculateDownloadTime } from '../engine/transmissionEngine';
import { calculateTransmissionTime } from '../engine/queueEngine';

interface ScheduleStore {
  blocks: ScheduleBlock[];
  selectedBlockId: string | null;
  draggedItem: {
    type: 'packet' | 'command';
    id: string;
  } | null;

  setDraggedItem: (item: { type: 'packet' | 'command'; id: string } | null) => void;
  selectBlock: (blockId: string | null) => void;
  
  addDownloadBlock: (
    window: VisibilityWindow,
    station: GroundStation,
    packets: DataPacket[],
    startTime: number
  ) => ScheduleBlock | null;
  
  addCommandBlock: (
    window: VisibilityWindow,
    station: GroundStation,
    commands: Command[],
    startTime: number
  ) => ScheduleBlock | null;
  
  removeBlock: (blockId: string) => void;
  moveBlock: (blockId: string, newStartTime: number) => boolean;
  resizeBlock: (blockId: string, newEndTime: number) => boolean;
  
  getBlocksForStation: (stationId: string) => ScheduleBlock[];
  getBlocksForWindow: (windowId: string) => ScheduleBlock[];
  getConflicts: (block: ScheduleBlock, station: GroundStation) => ScheduleBlock[];
  canAddBlock: (
    window: VisibilityWindow,
    station: GroundStation,
    type: 'download' | 'command',
    dataSize: number,
    startTime: number
  ) => boolean;
  
  clearSchedule: () => void;
  clearBlocks: () => void;
  autoSchedule: (
    windows: VisibilityWindow[],
    stations: GroundStation[],
    packets: DataPacket[],
    commands: Command[]
  ) => void;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  blocks: [],
  selectedBlockId: null,
  draggedItem: null,

  setDraggedItem: (item) => set({ draggedItem: item }),
  
  selectBlock: (blockId) => set({ selectedBlockId: blockId }),

  addDownloadBlock: (window, station, packets, startTime) => {
    const totalSize = packets.reduce((sum, p) => sum + p.size, 0);
    const duration = calculateDownloadTime(totalSize, station.bandwidth);
    
    if (!get().canAddBlock(window, station, 'download', totalSize, startTime)) {
      return null;
    }

    const block = createScheduleBlock(
      window,
      'download',
      packets.map(p => p.id),
      startTime,
      duration
    );

    set(state => ({ blocks: [...state.blocks, block] }));
    return block;
  },

  addCommandBlock: (window, station, commands, startTime) => {
    const totalSize = commands.reduce((sum, c) => sum + c.size, 0);
    const duration = calculateTransmissionTime({ size: totalSize } as Command, station.bandwidth);
    
    if (!get().canAddBlock(window, station, 'command', totalSize, startTime)) {
      return null;
    }

    const block = createScheduleBlock(
      window,
      'command',
      commands.map(c => c.id),
      startTime,
      duration
    );

    set(state => ({ blocks: [...state.blocks, block] }));
    return block;
  },

  removeBlock: (blockId) => {
    set(state => ({
      blocks: state.blocks.filter(b => b.id !== blockId),
      selectedBlockId: state.selectedBlockId === blockId ? null : state.selectedBlockId,
    }));
  },

  moveBlock: (blockId, newStartTime) => {
    const { blocks } = get();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return false;

    const duration = block.endTime - block.startTime;
    const newEndTime = newStartTime + duration;

    const window = blocks.find(b => b.id === blockId);
    if (!window) return false;

    const testBlock: ScheduleBlock = {
      ...block,
      startTime: newStartTime,
      endTime: newEndTime,
    };

    const station = { id: block.stationId, antennaSlewTime: 30 } as GroundStation;
    const conflicts = get().getConflicts(testBlock, station);
    
    if (conflicts.length > 0) return false;

    set(state => ({
      blocks: state.blocks.map(b =>
        b.id === blockId
          ? { ...b, startTime: newStartTime, endTime: newEndTime }
          : b
      ),
    }));

    return true;
  },

  resizeBlock: (blockId, newEndTime) => {
    const { blocks } = get();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return false;

    const testBlock: ScheduleBlock = {
      ...block,
      endTime: newEndTime,
    };

    const station = { id: block.stationId, antennaSlewTime: 30 } as GroundStation;
    const conflicts = get().getConflicts(testBlock, station);
    
    if (conflicts.length > 0) return false;

    set(state => ({
      blocks: state.blocks.map(b =>
        b.id === blockId ? { ...b, endTime: newEndTime } : b
      ),
    }));

    return true;
  },

  getBlocksForStation: (stationId) => {
    return get().blocks
      .filter(b => b.stationId === stationId)
      .sort((a, b) => a.startTime - b.startTime);
  },

  getBlocksForWindow: (windowId) => {
    return get().blocks.filter(b => b.windowId === windowId);
  },

  getConflicts: (block, station) => {
    return findConflicts(get().blocks, block, station.antennaSlewTime);
  },

  canAddBlock: (window, station, type, dataSize, startTime) => {
    const duration = type === 'download'
      ? calculateDownloadTime(dataSize, station.bandwidth)
      : calculateRequiredTime(dataSize, station.bandwidth);
    
    return canFitInWindow(
      get().blocks,
      window,
      startTime,
      duration,
      station
    );
  },

  clearSchedule: () => set({ blocks: [], selectedBlockId: null }),

  clearBlocks: () => set({ blocks: [], selectedBlockId: null }),

  autoSchedule: (windows, stations, packets, commands) => {
    const { clearBlocks, addDownloadBlock, addCommandBlock } = get();
    clearBlocks();

    const sortedWindows = [...windows].sort((a, b) => a.startTime - b.startTime);
    const sortedPackets = [...packets].sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    const sortedCommands = [...commands].sort((a, b) => a.priority - b.priority);

    let packetIndex = 0;
    let commandIndex = 0;

    sortedWindows.forEach(window => {
      const station = stations.find(s => s.id === window.groundStationId);
      if (!station) return;

      let currentTime = window.startTime;

      while (packetIndex < sortedPackets.length) {
        const packet = sortedPackets[packetIndex];
        const requiredTime = calculateDownloadTime(packet.size, station.bandwidth);
        
        if (currentTime + requiredTime <= window.endTime) {
          addDownloadBlock(window, station, [packet], currentTime);
          currentTime += requiredTime + 5000;
          packetIndex++;
        } else {
          break;
        }
      }

      while (commandIndex < sortedCommands.length) {
        const command = sortedCommands[commandIndex];
        const requiredTime = calculateTransmissionTime(command, station.bandwidth);
        
        if (currentTime + requiredTime <= window.endTime) {
          addCommandBlock(window, station, [command], currentTime);
          currentTime += requiredTime + 3000;
          commandIndex++;
        } else {
          break;
        }
      }
    });
  },
}));

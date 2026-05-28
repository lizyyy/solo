import { create } from 'zustand';
import type {
  GameState,
  GroundStation,
  VisibilityWindow,
  DataPacket,
  Command,
  CommandQueue,
  ScheduleBlock,
  MissionConfig,
} from '../types/mission';
import { getMissionData } from '../data/missions';
import { getGroundStation } from '../data/groundStations';
import { getProbe } from '../data/orbits';
import { generateId } from '../utils/time';

interface ActiveTransmission {
  type: 'download' | 'command';
  windowId: string;
  stationId: string;
  packetId?: string;
  commandId?: string;
  startTime: number;
  totalDuration: number;
  progress: number;
}

interface GameStore extends GameState {
  currentMission: MissionConfig | null;
  scheduleBlocks: ScheduleBlock[];
  activeTransmissions: ActiveTransmission[];
  score: number;
  setMission: (missionId: string, difficulty?: string) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  setSpeed: (speed: number) => void;
  updateTime: (delta: number) => void;
  updateGroundStation: (id: string, updates: Partial<GroundStation>) => void;
  updateWindow: (id: string, updates: Partial<VisibilityWindow>) => void;
  updatePacket: (id: string, updates: Partial<DataPacket>) => void;
  updateCommand: (id: string, updates: Partial<Command>) => void;
  addToQueue: (stationId: string, commandId: string) => void;
  removeFromQueue: (stationId: string, commandId: string) => void;
  reorderQueue: (stationId: string, fromIndex: number, toIndex: number) => void;
  addScheduleBlock: (block: ScheduleBlock) => void;
  removeScheduleBlock: (blockId: string) => void;
  updateScheduleBlock: (blockId: string, updates: Partial<ScheduleBlock>) => void;
  addActiveTransmission: (transmission: ActiveTransmission) => void;
  removeActiveTransmission: (index: number) => void;
  updateActiveTransmission: (index: number, updates: Partial<ActiveTransmission>) => void;
  addScore: (points: number) => void;
  deductScore: (points: number) => void;
  resetGame: () => void;
}

const initialState: GameState = {
  missionId: '',
  status: 'idle',
  currentTime: 0,
  speed: 1,
  groundStations: [],
  probe: {
    id: '',
    name: '',
    orbitParams: { semiMajorAxis: 0, eccentricity: 0, inclination: 0, raan: 0 },
    dataStorage: 0,
    commandBufferSize: 0,
    currentDataUsage: 0,
  },
  visibilityWindows: [],
  dataPackets: [],
  commands: [],
  queues: {},
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  currentMission: null,
  scheduleBlocks: [],
  activeTransmissions: [],
  score: 0,

  setMission: (missionId: string, difficulty?: string) => {
    const missionData = getMissionData(missionId);
    if (!missionData) return;

    const groundStations = missionData.config.groundStationIds
      .map(id => getGroundStation(id))
      .filter(Boolean) as GroundStation[];
    
    const probe = getProbe(missionData.config.probeId);
    if (!probe) return;

    const startTime = Date.now();
    const windows = missionData.windows.map(w => ({
      ...w,
      startTime: startTime + (w.startTime - missionData.windows[0].startTime),
      endTime: startTime + (w.endTime - missionData.windows[0].startTime),
    }));

    const packets = missionData.packets.map(p => ({
      ...p,
      deadline: startTime + (p.deadline - missionData.windows[0].startTime),
      createdAt: startTime - 3600000,
    }));

    const commands = missionData.commands.map(c => ({
      ...c,
      timeout: startTime + (c.timeout - missionData.windows[0].startTime),
    }));

    const queues: Record<string, CommandQueue> = {};
    groundStations.forEach(station => {
      queues[station.id] = {
        groundStationId: station.id,
        commands: [],
        currentIndex: 0,
      };
    });

    set({
      currentMission: missionData.config,
      missionId,
      groundStations,
      probe,
      visibilityWindows: windows,
      dataPackets: packets,
      commands,
      queues,
      currentTime: startTime,
      scheduleBlocks: [],
      activeTransmissions: [],
      score: 0,
      status: 'idle',
    });
  },

  startGame: () => {
    const { currentTime } = get();
    set({ status: 'running', currentTime: currentTime || Date.now() });
  },

  pauseGame: () => set({ status: 'paused' }),

  resumeGame: () => set({ status: 'running' }),

  endGame: () => set({ status: 'completed' }),

  setSpeed: (speed: number) => set({ speed: Math.max(0.5, Math.min(8, speed)) }),

  updateTime: (delta: number) => {
    const { currentTime, status } = get();
    if (status !== 'running') return;
    set({ currentTime: currentTime + delta });
  },

  updateGroundStation: (id: string, updates: Partial<GroundStation>) => {
    set(state => ({
      groundStations: state.groundStations.map(s =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  },

  updateWindow: (id: string, updates: Partial<VisibilityWindow>) => {
    set(state => ({
      visibilityWindows: state.visibilityWindows.map(w =>
        w.id === id ? { ...w, ...updates } : w
      ),
    }));
  },

  updatePacket: (id: string, updates: Partial<DataPacket>) => {
    set(state => ({
      dataPackets: state.dataPackets.map(p =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  },

  updateCommand: (id: string, updates: Partial<Command>) => {
    set(state => ({
      commands: state.commands.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  },

  addToQueue: (stationId: string, commandId: string) => {
    set(state => {
      const queue = state.queues[stationId];
      if (!queue) return state;
      if (queue.commands.includes(commandId)) return state;

      return {
        queues: {
          ...state.queues,
          [stationId]: {
            ...queue,
            commands: [...queue.commands, commandId],
          },
        },
        commands: state.commands.map(c =>
          c.id === commandId ? { ...c, status: 'queued' as const } : c
        ),
      };
    });
  },

  removeFromQueue: (stationId: string, commandId: string) => {
    set(state => {
      const queue = state.queues[stationId];
      if (!queue) return state;

      const index = queue.commands.indexOf(commandId);
      if (index === -1) return state;

      const newCommands = [...queue.commands];
      newCommands.splice(index, 1);

      return {
        queues: {
          ...state.queues,
          [stationId]: {
            ...queue,
            commands: newCommands,
            currentIndex: index < queue.currentIndex ? queue.currentIndex - 1 : queue.currentIndex,
          },
        },
        commands: state.commands.map(c =>
          c.id === commandId ? { ...c, status: 'pending' as const } : c
        ),
      };
    });
  },

  reorderQueue: (stationId: string, fromIndex: number, toIndex: number) => {
    set(state => {
      const queue = state.queues[stationId];
      if (!queue) return state;

      const newCommands = [...queue.commands];
      const [item] = newCommands.splice(fromIndex, 1);
      newCommands.splice(toIndex, 0, item);

      let newCurrentIndex = queue.currentIndex;
      if (queue.currentIndex === fromIndex) {
        newCurrentIndex = toIndex;
      } else if (fromIndex < queue.currentIndex && toIndex >= queue.currentIndex) {
        newCurrentIndex = queue.currentIndex - 1;
      } else if (fromIndex > queue.currentIndex && toIndex <= queue.currentIndex) {
        newCurrentIndex = queue.currentIndex + 1;
      }

      return {
        queues: {
          ...state.queues,
          [stationId]: {
            ...queue,
            commands: newCommands,
            currentIndex: newCurrentIndex,
          },
        },
      };
    });
  },

  addScheduleBlock: (block: ScheduleBlock) => {
    set(state => ({
      scheduleBlocks: [...state.scheduleBlocks, block],
    }));
  },

  removeScheduleBlock: (blockId: string) => {
    set(state => ({
      scheduleBlocks: state.scheduleBlocks.filter(b => b.id !== blockId),
    }));
  },

  updateScheduleBlock: (blockId: string, updates: Partial<ScheduleBlock>) => {
    set(state => ({
      scheduleBlocks: state.scheduleBlocks.map(b =>
        b.id === blockId ? { ...b, ...updates } : b
      ),
    }));
  },

  addActiveTransmission: (transmission: ActiveTransmission) => {
    set(state => ({
      activeTransmissions: [...state.activeTransmissions, transmission],
    }));
  },

  removeActiveTransmission: (index: number) => {
    set(state => {
      const newTransmissions = [...state.activeTransmissions];
      newTransmissions.splice(index, 1);
      return { activeTransmissions: newTransmissions };
    });
  },

  updateActiveTransmission: (index: number, updates: Partial<ActiveTransmission>) => {
    set(state => {
      const newTransmissions = [...state.activeTransmissions];
      newTransmissions[index] = { ...newTransmissions[index], ...updates };
      return { activeTransmissions: newTransmissions };
    });
  },

  addScore: (points: number) => {
    set(state => ({ score: state.score + points }));
  },

  deductScore: (points: number) => {
    set(state => ({ score: Math.max(0, state.score - points) }));
  },

  resetGame: () => {
    const { missionId } = get();
    set({ ...initialState, missionId: '' });
    if (missionId) {
      get().setMission(missionId);
    }
  },
}));

export type { ActiveTransmission };

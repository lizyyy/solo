import { create } from 'zustand';
import { Bus, ParkingSpot, StudentQueue, Conflict, ScheduleState, SampleData } from '../types';
import { ConflictDetector } from '../engine/ConflictDetector';
import { sampleData } from '../data/samples';

interface ScheduleActions {
  loadSample: (sampleIndex: number) => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setPlaySpeed: (speed: number) => void;
  setViewMode: (mode: '3d' | '2d') => void;
  setCameraView: (view: 'default' | 'top' | 'front' | 'side') => void;
  selectBus: (busId: string | null) => void;
  updateBusDepartureTime: (busId: string, time: number) => void;
  reset: () => void;
  setShowReport: (show: boolean) => void;
  setFilterStatus: (status: 'all' | 'parked' | 'boarding' | 'departing' | 'departed') => void;
  setSearchQuery: (query: string) => void;
  tick: (deltaTime: number) => void;
  resolveConflict: (conflictId: string) => void;
}

const initialSample = sampleData[0];
const initialConflicts = ConflictDetector.getInstance().detectAllConflicts(initialSample.buses);

const getInitialState = (sample: SampleData): ScheduleState => {
  const conflicts = ConflictDetector.getInstance().detectAllConflicts(sample.buses);
  const maxDepartureTime = Math.max(...sample.buses.map(b => b.departureTime));
  return {
    buses: sample.buses.map(b => ({ ...b })),
    parkingSpots: sample.parkingSpots.map(s => ({ ...s })),
    queues: sample.queues.map(q => ({ ...q })),
    conflicts,
    currentTime: 0,
    totalDuration: maxDepartureTime + 60,
    isPlaying: false,
    playSpeed: 1,
    viewMode: '3d',
    cameraView: 'default',
    selectedBusId: null,
    showReport: false,
    filterStatus: 'all',
    searchQuery: '',
  };
};

export const useScheduleStore = create<ScheduleState & ScheduleActions>((set, get) => ({
  ...getInitialState(initialSample),

  loadSample: (sampleIndex: number) => {
    const sample = sampleData[sampleIndex];
    if (sample) {
      set(getInitialState(sample));
    }
  },

  setCurrentTime: (time: number) => {
    const { totalDuration, buses, queues } = get();
    const clampedTime = Math.max(0, Math.min(time, totalDuration));
    
    const updatedBuses = buses.map(bus => {
      if (clampedTime < bus.departureTime - 10) {
        return { ...bus, status: 'parked' as const, currentStudents: 0 };
      } else if (clampedTime >= bus.departureTime - 10 && clampedTime < bus.departureTime) {
        return { ...bus, status: 'boarding' as const, currentStudents: Math.floor(bus.capacity * (clampedTime - (bus.departureTime - 10)) / 10) };
      } else if (clampedTime >= bus.departureTime && clampedTime < bus.departureTime + 10) {
        return { ...bus, status: 'departing' as const, currentStudents: bus.capacity };
      } else {
        return { ...bus, status: 'departed' as const, currentStudents: bus.capacity };
      }
    });

    const updatedQueues = queues.map(queue => {
      const bus = buses.find(b => b.id === queue.busId);
      if (!bus) return queue;
      
      if (clampedTime < bus.departureTime - 10) {
        return { ...queue, currentIndex: 0 };
      } else if (clampedTime >= bus.departureTime - 10 && clampedTime < bus.departureTime) {
        const progress = (clampedTime - (bus.departureTime - 10)) / 10;
        return { ...queue, currentIndex: Math.floor(queue.totalStudents * progress) };
      } else {
        return { ...queue, currentIndex: queue.totalStudents };
      }
    });

    set({ currentTime: clampedTime, buses: updatedBuses, queues: updatedQueues });
  },

  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),

  setPlaySpeed: (speed: number) => set({ playSpeed: speed }),

  setViewMode: (mode: '3d' | '2d') => set({ viewMode: mode }),

  setCameraView: (view: 'default' | 'top' | 'front' | 'side') => set({ cameraView: view }),

  selectBus: (busId: string | null) => set({ selectedBusId: busId }),

  updateBusDepartureTime: (busId: string, time: number) => {
    set(state => {
      const updatedBuses = state.buses.map(bus =>
        bus.id === busId ? { ...bus, departureTime: Math.max(0, time) } : bus
      );
      const newConflicts = ConflictDetector.getInstance().detectAllConflicts(updatedBuses);
      return { buses: updatedBuses, conflicts: newConflicts };
    });
  },

  reset: () => {
    const currentSample = sampleData.find(s => 
      s.buses.length === get().buses.length
    ) || sampleData[0];
    set(getInitialState(currentSample));
  },

  setShowReport: (show: boolean) => set({ showReport: show }),

  setFilterStatus: (status: 'all' | 'parked' | 'boarding' | 'departing' | 'departed') => 
    set({ filterStatus: status }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  tick: (deltaTime: number) => {
    const { currentTime, totalDuration, playSpeed, isPlaying } = get();
    if (!isPlaying) return;
    
    const newTime = currentTime + deltaTime * playSpeed;
    if (newTime >= totalDuration) {
      set({ currentTime: totalDuration, isPlaying: false });
    } else {
      get().setCurrentTime(newTime);
    }
  },

  resolveConflict: (conflictId: string) => set(state => ({
    conflicts: state.conflicts.map(c => 
      c.id === conflictId ? { ...c, resolved: true } : c
    ),
  })),
}));

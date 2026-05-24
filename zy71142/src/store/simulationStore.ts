import { create } from 'zustand';
import { EvacuationPlan, Student, Conflict, Statistics } from '@/types';
import { EvacuationSimulator } from '@/engine/simulator';
import { allPlans } from '@/data/plans';

interface SimulationStore {
  plans: EvacuationPlan[];
  selectedPlan: EvacuationPlan | null;
  simulator: EvacuationSimulator | null;
  isPlaying: boolean;
  currentTime: number;
  speed: number;
  students: Student[];
  conflicts: Conflict[];
  statistics: Statistics;
  cameraView: 'overview' | 'top' | 'front' | 'side' | 'free';
  showPaths: boolean;
  showLabels: boolean;
  floorOpacity: number;
  showReport: boolean;
  
  setSelectedPlan: (planId: string) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setCameraView: (view: 'overview' | 'top' | 'front' | 'side' | 'free') => void;
  setShowPaths: (show: boolean) => void;
  setShowLabels: (show: boolean) => void;
  setFloorOpacity: (opacity: number) => void;
  setShowReport: (show: boolean) => void;
  resetSimulation: () => void;
  updateSimulation: (deltaTime: number) => void;
}

const emptyStatistics: Statistics = {
  totalStudents: 0,
  evacuatedStudents: 0,
  avgEvacuationTime: 0,
  maxEvacuationTime: 0,
  minEvacuationTime: 0,
  maxStairUsage: 0,
  conflictCount: 0,
  stairUtilization: {},
  classroomCompletion: {}
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  plans: allPlans,
  selectedPlan: allPlans[0],
  simulator: new EvacuationSimulator(allPlans[0]),
  isPlaying: false,
  currentTime: 0,
  speed: 1,
  students: [],
  conflicts: [],
  statistics: emptyStatistics,
  cameraView: 'overview',
  showPaths: true,
  showLabels: true,
  floorOpacity: 0.3,
  showReport: false,
  
  setSelectedPlan: (planId: string) => {
    const plan = allPlans.find(p => p.id === planId);
    if (plan) {
      const simulator = new EvacuationSimulator(plan);
      set({
        selectedPlan: plan,
        simulator,
        isPlaying: false,
        currentTime: 0,
        students: simulator.getStudents(),
        conflicts: [],
        statistics: emptyStatistics
      });
    }
  },
  
  setPlaying: (playing: boolean) => {
    const { simulator } = get();
    if (simulator) {
      if (playing) {
        simulator.start();
      } else {
        simulator.pause();
      }
    }
    set({ isPlaying: playing });
  },
  
  setSpeed: (speed: number) => {
    set({ speed });
  },
  
  setCameraView: (view) => {
    set({ cameraView: view });
  },
  
  setShowPaths: (show) => {
    set({ showPaths: show });
  },
  
  setShowLabels: (show) => {
    set({ showLabels: show });
  },
  
  setFloorOpacity: (opacity) => {
    set({ floorOpacity: opacity });
  },
  
  setShowReport: (show) => {
    set({ showReport: show });
  },
  
  resetSimulation: () => {
    const { simulator, selectedPlan } = get();
    if (simulator) {
      simulator.reset();
      simulator.pause();
      set({
        isPlaying: false,
        currentTime: 0,
        students: simulator.getStudents(),
        conflicts: [],
        statistics: emptyStatistics
      });
    }
  },
  
  updateSimulation: (deltaTime: number) => {
    const { simulator, speed, isPlaying } = get();
    if (simulator && isPlaying) {
      simulator.update(deltaTime, speed);
      set({
        currentTime: simulator.getCurrentTime(),
        students: [...simulator.getStudents()],
        conflicts: [...simulator.getConflicts()],
        statistics: simulator.getStatistics()
      });
      
      if (simulator.isComplete()) {
        simulator.pause();
        set({ isPlaying: false });
      }
    }
  }
}));

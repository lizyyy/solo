import { create } from 'zustand';
import { EvacuationPlan, Student, Conflict, Statistics, Classroom } from '@/types';
import { EvacuationSimulator } from '@/engine/simulator';
import { allPlans } from '@/data/plans';

interface CompareResult {
  planId: string;
  planName: string;
  totalTime: number;
  avgEvacuationTime: number;
  conflictCount: number;
  maxQueueLength: number;
  evacuatedStudents: number;
}

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
  showCompare: boolean;
  compareResults: CompareResult[];
  filteredClassrooms: string[];
  filteredStairs: string[];
  studentFilter: 'all' | 'waiting' | 'moving' | 'inStair' | 'queued' | 'arrived';
  
  setSelectedPlan: (planId: string) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setCameraView: (view: 'overview' | 'top' | 'front' | 'side' | 'free') => void;
  setShowPaths: (show: boolean) => void;
  setShowLabels: (show: boolean) => void;
  setFloorOpacity: (opacity: number) => void;
  setShowReport: (show: boolean) => void;
  setShowCompare: (show: boolean) => void;
  resetSimulation: () => void;
  updateSimulation: (deltaTime: number) => void;
  addCustomPlan: (plan: EvacuationPlan) => void;
  removePlan: (planId: string) => void;
  runComparison: () => void;
  setFilteredClassrooms: (ids: string[]) => void;
  setFilteredStairs: (ids: string[]) => void;
  setStudentFilter: (filter: 'all' | 'waiting' | 'moving' | 'inStair' | 'queued' | 'arrived') => void;
  updateClassroomOrder: (classroomId: string, newOrder: number, newDelay: number) => void;
  updateClassroomStair: (classroomId: string, stairId: string) => void;
  importPlan: (planData: string) => boolean;
  exportPlan: (planId: string) => string;
  toggleStair: (stairId: string) => void;
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
  classroomCompletion: {},
  classroomQueueTime: {},
  totalQueueLength: 0,
  blockageCount: 0
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
  showCompare: false,
  compareResults: [],
  filteredClassrooms: [],
  filteredStairs: [],
  studentFilter: 'all',
  
  setSelectedPlan: (planId: string) => {
    const { plans } = get();
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      const simulator = new EvacuationSimulator(plan);
      set({
        selectedPlan: plan,
        simulator,
        isPlaying: false,
        currentTime: 0,
        students: simulator.getStudents(),
        conflicts: [],
        statistics: emptyStatistics,
        filteredClassrooms: [],
        filteredStairs: []
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
  
  setShowCompare: (show) => {
    set({ showCompare: show });
  },
  
  resetSimulation: () => {
    const { simulator } = get();
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
  },
  
  addCustomPlan: (plan: EvacuationPlan) => {
    const { plans } = get();
    set({ plans: [...plans, plan] });
  },
  
  removePlan: (planId: string) => {
    const { plans, selectedPlan, setSelectedPlan } = get();
    const newPlans = plans.filter(p => p.id !== planId);
    set({ plans: newPlans });
    
    if (selectedPlan?.id === planId && newPlans.length > 0) {
      setSelectedPlan(newPlans[0].id);
    }
  },
  
  runComparison: () => {
    const { plans } = get();
    const results: CompareResult[] = [];
    
    plans.forEach(plan => {
      const sim = new EvacuationSimulator(plan);
      sim.start();
      
      for (let i = 0; i < 300; i++) {
        sim.update(0.5, 4);
        if (sim.isComplete()) break;
      }
      
      const stats = sim.getStatistics();
      results.push({
        planId: plan.id,
        planName: plan.name,
        totalTime: sim.getCurrentTime(),
        avgEvacuationTime: stats.avgEvacuationTime,
        conflictCount: stats.conflictCount,
        maxQueueLength: stats.totalQueueLength || 0,
        evacuatedStudents: stats.evacuatedStudents
      });
    });
    
    set({ compareResults: results, showCompare: true });
  },
  
  setFilteredClassrooms: (ids) => {
    set({ filteredClassrooms: ids });
  },
  
  setFilteredStairs: (ids) => {
    set({ filteredStairs: ids });
  },
  
  setStudentFilter: (filter) => {
    set({ studentFilter: filter });
  },
  
  updateClassroomOrder: (classroomId: string, newOrder: number, newDelay: number) => {
    const { selectedPlan, simulator } = get();
    if (!selectedPlan || !simulator) return;
    
    const updatedClassrooms = selectedPlan.classrooms.map(c => {
      if (c.id === classroomId) {
        return { ...c, exitOrder: newOrder, exitDelay: newDelay };
      }
      return c;
    });
    
    const updatedPlan: EvacuationPlan = {
      ...selectedPlan,
      classrooms: updatedClassrooms
    };
    
    simulator.setPlan(updatedPlan);
    set({ 
      selectedPlan: updatedPlan,
      students: simulator.getStudents()
    });
  },
  
  updateClassroomStair: (classroomId: string, stairId: string) => {
    const { selectedPlan, simulator } = get();
    if (!selectedPlan || !simulator) return;
    
    const updatedClassrooms = selectedPlan.classrooms.map(c => {
      if (c.id === classroomId) {
        return { ...c, assignedStairId: stairId };
      }
      return c;
    });
    
    const updatedPlan: EvacuationPlan = {
      ...selectedPlan,
      classrooms: updatedClassrooms
    };
    
    simulator.setPlan(updatedPlan);
    set({ 
      selectedPlan: updatedPlan,
      students: simulator.getStudents()
    });
  },
  
  importPlan: (planData: string): boolean => {
    try {
      const plan = JSON.parse(planData) as EvacuationPlan;
      if (plan.id && plan.name && plan.building) {
        const { plans, setSelectedPlan } = get();
        const newPlan = { ...plan, id: `${plan.id}-${Date.now()}` };
        set({ plans: [...plans, newPlan] });
        setSelectedPlan(newPlan.id);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
  
  exportPlan: (planId: string): string => {
    const { plans } = get();
    const plan = plans.find(p => p.id === planId);
    return plan ? JSON.stringify(plan, null, 2) : '';
  },
  
  toggleStair: (stairId: string) => {
    const { selectedPlan, simulator } = get();
    if (!selectedPlan || !simulator) return;
    
    const updatedStairs = selectedPlan.stairs.map(s => {
      if (s.id === stairId) {
        return { ...s, isClosed: !s.isClosed };
      }
      return s;
    });
    
    const updatedClosedAreas = updatedStairs
      .filter(s => s.isClosed)
      .map(s => s.id);
    
    const updatedPlan: EvacuationPlan = {
      ...selectedPlan,
      stairs: updatedStairs,
      closedAreas: updatedClosedAreas
    };
    
    simulator.setPlan(updatedPlan);
    set({ 
      selectedPlan: updatedPlan,
      students: simulator.getStudents()
    });
  }
}));

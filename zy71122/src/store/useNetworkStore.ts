import { create } from 'zustand';
import { produce } from 'immer';
import type { Network, Valve, ValveAction, Solution, ImpactAnalysis, Scenario, ViewMode } from '@/types';
import { performImpactAnalysis } from '@/utils/networkAnalyzer';
import { validateSolution } from '@/utils/reportGenerator';
import { normalScenario } from '@/data/scenarios/normal';

interface NetworkState {
  currentScenario: Scenario;
  network: Network;
  initialNetwork: Network;
  valveActions: ValveAction[];
  impactAnalysis: ImpactAnalysis;
  selectedValveId: string | null;
  hoveredValveId: string | null;
  viewMode: ViewMode;
  isPlaying: boolean;
  timelineStep: number;
  solutions: Solution[];
  selectedSolutionId: string | null;
  showZones: boolean;
  showValves: boolean;
  showRepairPoints: boolean;
}

interface NetworkActions {
  setScenario: (scenario: Scenario) => void;
  toggleValve: (valveId: string) => void;
  setValveStatus: (valveId: string, status: 'open' | 'closed') => void;
  setSelectedValve: (valveId: string | null) => void;
  setHoveredValve: (valveId: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  reset: () => void;
  saveSolution: (name: string) => void;
  deleteSolution: (solutionId: string) => void;
  selectSolution: (solutionId: string | null) => void;
  loadSolution: (solutionId: string) => void;
  setTimelineStep: (step: number) => void;
  setIsPlaying: (playing: boolean) => void;
  stepForward: () => void;
  stepBackward: () => void;
  toggleShowZones: () => void;
  toggleShowValves: () => void;
  toggleShowRepairPoints: () => void;
  recalculateImpact: () => void;
}

const createEmptyImpact = (): ImpactAnalysis => ({
  affectedZoneIds: [],
  affectedCustomerCount: 0,
  isolatedPipes: [],
  isolatedNodes: [],
  hasConflict: false,
  conflictDetails: [],
});

export const useNetworkStore = create<NetworkState & NetworkActions>((set, get) => ({
  currentScenario: normalScenario,
  network: JSON.parse(JSON.stringify(normalScenario.initialNetwork)),
  initialNetwork: JSON.parse(JSON.stringify(normalScenario.initialNetwork)),
  valveActions: [],
  impactAnalysis: createEmptyImpact(),
  selectedValveId: null,
  hoveredValveId: null,
  viewMode: '3d',
  isPlaying: false,
  timelineStep: 0,
  solutions: [],
  selectedSolutionId: null,
  showZones: true,
  showValves: true,
  showRepairPoints: true,

  setScenario: (scenario: Scenario) => {
    const network = JSON.parse(JSON.stringify(scenario.initialNetwork));
    set({
      currentScenario: scenario,
      network,
      initialNetwork: JSON.parse(JSON.stringify(scenario.initialNetwork)),
      valveActions: [],
      impactAnalysis: performImpactAnalysis(network),
      selectedValveId: null,
      hoveredValveId: null,
      timelineStep: 0,
    });
  },

  toggleValve: (valveId: string) => {
    set(
      produce((state: NetworkState) => {
        const valve = state.network.valves.find((v: Valve) => v.id === valveId);
        if (!valve || valve.status === 'failed') return;

        const fromStatus = valve.status;
        const toStatus = valve.status === 'open' ? 'closed' : 'open';

        valve.status = toStatus;

        state.valveActions.push({
          valveId,
          fromStatus,
          toStatus,
          timestamp: Date.now(),
        });

        state.timelineStep = state.valveActions.length;
        state.impactAnalysis = performImpactAnalysis(state.network);
      })
    );
  },

  setValveStatus: (valveId: string, status: 'open' | 'closed') => {
    set(
      produce((state: NetworkState) => {
        const valve = state.network.valves.find((v: Valve) => v.id === valveId);
        if (!valve || valve.status === 'failed' || valve.status === status) return;

        const fromStatus = valve.status as 'open' | 'closed';
        valve.status = status;

        state.valveActions.push({
          valveId,
          fromStatus,
          toStatus: status,
          timestamp: Date.now(),
        });

        state.timelineStep = state.valveActions.length;
        state.impactAnalysis = performImpactAnalysis(state.network);
      })
    );
  },

  setSelectedValve: (valveId: string | null) => {
    set({ selectedValveId: valveId });
  },

  setHoveredValve: (valveId: string | null) => {
    set({ hoveredValveId: valveId });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  reset: () => {
    const { currentScenario } = get();
    const network = JSON.parse(JSON.stringify(currentScenario.initialNetwork));
    set({
      network,
      valveActions: [],
      impactAnalysis: performImpactAnalysis(network),
      selectedValveId: null,
      hoveredValveId: null,
      timelineStep: 0,
      isPlaying: false,
    });
  },

  saveSolution: (name: string) => {
    const { network, valveActions, impactAnalysis } = get();
    const solution: Solution = {
      id: `sol-${Date.now()}`,
      name,
      createdAt: Date.now(),
      valveActions: [...valveActions],
      impactAnalysis: { ...impactAnalysis },
      networkState: JSON.parse(JSON.stringify(network)),
    };
    set(
      produce((state: NetworkState) => {
        state.solutions.push(solution);
      })
    );
  },

  deleteSolution: (solutionId: string) => {
    set(
      produce((state: NetworkState) => {
        state.solutions = state.solutions.filter((s) => s.id !== solutionId);
        if (state.selectedSolutionId === solutionId) {
          state.selectedSolutionId = null;
        }
      })
    );
  },

  selectSolution: (solutionId: string | null) => {
    set({ selectedSolutionId: solutionId });
  },

  loadSolution: (solutionId: string) => {
    const { solutions } = get();
    const solution = solutions.find((s) => s.id === solutionId);
    if (solution) {
      set({
        network: JSON.parse(JSON.stringify(solution.networkState)),
        valveActions: [...solution.valveActions],
        impactAnalysis: { ...solution.impactAnalysis },
        timelineStep: solution.valveActions.length,
        selectedSolutionId: solutionId,
      });
    }
  },

  setTimelineStep: (step: number) => {
    set(
      produce((state: NetworkState) => {
        const clampedStep = Math.max(0, Math.min(step, state.valveActions.length));
        state.timelineStep = clampedStep;

        state.network = JSON.parse(JSON.stringify(state.initialNetwork));

        for (let i = 0; i < clampedStep; i++) {
          const action = state.valveActions[i];
          const valve = state.network.valves.find((v: Valve) => v.id === action.valveId);
          if (valve && valve.status !== 'failed') {
            valve.status = action.toStatus;
          }
        }

        state.impactAnalysis = performImpactAnalysis(state.network);
      })
    );
  },

  setIsPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  stepForward: () => {
    const { timelineStep, valveActions } = get();
    if (timelineStep < valveActions.length) {
      get().setTimelineStep(timelineStep + 1);
    }
  },

  stepBackward: () => {
    const { timelineStep } = get();
    if (timelineStep > 0) {
      get().setTimelineStep(timelineStep - 1);
    }
  },

  toggleShowZones: () => {
    set((state) => ({ showZones: !state.showZones }));
  },

  toggleShowValves: () => {
    set((state) => ({ showValves: !state.showValves }));
  },

  toggleShowRepairPoints: () => {
    set((state) => ({ showRepairPoints: !state.showRepairPoints }));
  },

  recalculateImpact: () => {
    const { network } = get();
    set({ impactAnalysis: performImpactAnalysis(network) });
  },
}));

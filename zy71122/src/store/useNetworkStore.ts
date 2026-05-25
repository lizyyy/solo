import { create } from 'zustand';
import { produce } from 'immer';
import type { Network, Valve, ValveAction, Solution, ImpactAnalysis, Scenario, ViewMode } from '@/types';
import { performImpactAnalysis } from '@/utils/networkAnalyzer';
import { normalScenario } from '@/data/scenarios/normal';

interface NetworkState {
  currentScenario: Scenario;
  customScenarios: Scenario[];
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
  comparisonSolutionIds: string[];
  showComparison: boolean;
  showZones: boolean;
  showValves: boolean;
  showRepairPoints: boolean;
}

interface NetworkActions {
  setScenario: (scenario: Scenario) => void;
  importScenario: (scenarioData: unknown) => { success: boolean; error?: string };
  deleteCustomScenario: (scenarioId: string) => void;
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
  toggleComparisonSolution: (solutionId: string) => void;
  setShowComparison: (show: boolean) => void;
  clearComparison: () => void;
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

const validateScenario = (data: unknown): data is Omit<Scenario, 'id'> & { id?: string } => {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.initialNetwork === 'object' &&
    obj.initialNetwork !== null
  );
};

export const useNetworkStore = create<NetworkState & NetworkActions>((set, get) => ({
  currentScenario: normalScenario,
  customScenarios: [],
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
  comparisonSolutionIds: [],
  showComparison: false,
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

  importScenario: (scenarioData: unknown) => {
    if (!validateScenario(scenarioData)) {
      return { success: false, error: '场景数据格式不正确，请检查JSON文件' };
    }

    const newScenario: Scenario = {
      ...scenarioData,
      id: `custom-${Date.now()}`,
    };

    set(
      produce((state: NetworkState) => {
        state.customScenarios.push(newScenario);
      })
    );

    const network = JSON.parse(JSON.stringify(newScenario.initialNetwork));
    set({
      currentScenario: newScenario,
      network,
      initialNetwork: JSON.parse(JSON.stringify(newScenario.initialNetwork)),
      valveActions: [],
      impactAnalysis: performImpactAnalysis(network),
      selectedValveId: null,
      hoveredValveId: null,
      timelineStep: 0,
    });

    return { success: true };
  },

  deleteCustomScenario: (scenarioId: string) => {
    set(
      produce((state: NetworkState) => {
        state.customScenarios = state.customScenarios.filter((s) => s.id !== scenarioId);
        if (state.currentScenario.id === scenarioId) {
          state.currentScenario = normalScenario;
          state.network = JSON.parse(JSON.stringify(normalScenario.initialNetwork));
          state.initialNetwork = JSON.parse(JSON.stringify(normalScenario.initialNetwork));
          state.valveActions = [];
          state.impactAnalysis = performImpactAnalysis(state.network);
          state.timelineStep = 0;
        }
      })
    );
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

  toggleComparisonSolution: (solutionId: string) => {
    set(
      produce((state: NetworkState) => {
        const index = state.comparisonSolutionIds.indexOf(solutionId);
        if (index > -1) {
          state.comparisonSolutionIds.splice(index, 1);
        } else if (state.comparisonSolutionIds.length < 3) {
          state.comparisonSolutionIds.push(solutionId);
        }
      })
    );
  },

  setShowComparison: (show: boolean) => {
    set({ showComparison: show });
  },

  clearComparison: () => {
    set({ comparisonSolutionIds: [], showComparison: false });
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

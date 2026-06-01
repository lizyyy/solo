import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

import type { AppState, Decision, Params, ViewState, ProjectMeta } from '@/types';
import { evaluateDevice, detectConflicts } from '@/utils/guidance';
import { sampleDevices, sampleCadPoints, sampleProject } from '@/data/sampleData';

const defaultParams: Params = {
  distanceThreshold: 50,
  coordTolerance: 5,
  coordSystemHandling: 'separate',
};

const defaultView: ViewState = {
  currentFloor: 'B1',
  zoom: 1,
  rotation: 0,
  panX: 0,
  panY: 0,
  selectedDeviceId: null,
};

interface AppStore extends AppState {
  loadSampleData: () => void;
  setParams: (params: Partial<Params>) => void;
  setView: (view: Partial<ViewState>) => void;
  setSelectedDevice: (deviceId: string | null) => void;
  addDecision: (decision: Omit<Decision, 'id' | 'timestamp'>) => void;
  resolveConflict: (conflictId: string, operator: string) => void;
  setProject: (project: Partial<ProjectMeta>) => void;
  resetView: () => void;
  recalculateAll: () => void;
}

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        devices: [],
        cadPoints: [],
        conflicts: [],
        decisions: [],
        params: defaultParams,
        view: defaultView,
        project: sampleProject,

        loadSampleData: () => {
          const { params } = get();
          const evaluatedDevices = sampleDevices.map(device => {
            const result = evaluateDevice(device, sampleCadPoints, params);
            return {
              ...device,
              status: result.status,
              score: result.score,
              reasons: result.reasons,
            };
          });
          const conflicts = detectConflicts(evaluatedDevices, sampleCadPoints, params);

          set({
            devices: evaluatedDevices,
            cadPoints: sampleCadPoints,
            conflicts,
            decisions: [],
            view: { ...defaultView, currentFloor: 'B1' },
          });
        },

        setParams: (newParams) => {
          set((state) => {
            const updatedParams = { ...state.params, ...newParams };
            const evaluatedDevices = state.devices.map(device => {
              const result = evaluateDevice(device, state.cadPoints, updatedParams);
              return {
                ...device,
                status: result.status,
                score: result.score,
                reasons: result.reasons,
              };
            });
            const updatedConflicts = detectConflicts(evaluatedDevices, state.cadPoints, updatedParams);

            return {
              params: updatedParams,
              devices: evaluatedDevices,
              conflicts: updatedConflicts,
            };
          });
        },

        setView: (newView) => {
          set((state) => ({
            view: { ...state.view, ...newView },
          }));
        },

        setSelectedDevice: (deviceId) => {
          set((state) => ({
            view: { ...state.view, selectedDeviceId: deviceId },
          }));
        },

        addDecision: (decision) => {
          set((state) => ({
            decisions: [
              ...state.decisions,
              {
                ...decision,
                id: `decision-${Date.now()}`,
                timestamp: new Date().toISOString(),
              },
            ],
          }));
        },

        resolveConflict: (conflictId, operator) => {
          set((state) => ({
            conflicts: state.conflicts.map(c =>
              c.id === conflictId
                ? { ...c, resolved: true, resolvedBy: operator, resolvedAt: new Date().toISOString() }
                : c
            ),
          }));
        },

        setProject: (project) => {
          set((state) => ({
            project: { ...state.project, ...project, updatedAt: new Date().toISOString() },
          }));
        },

        resetView: () => {
          set({
            view: { ...defaultView, currentFloor: get().view.currentFloor },
          });
        },

        recalculateAll: () => {
          const { devices, cadPoints, params } = get();
          const evaluatedDevices = devices.map(device => {
            const result = evaluateDevice(device, cadPoints, params);
            return {
              ...device,
              status: result.status,
              score: result.score,
              reasons: result.reasons,
            };
          });
          const conflicts = detectConflicts(evaluatedDevices, cadPoints, params);
          set({ devices: evaluatedDevices, conflicts });
        },
      }),
      {
        name: 'parking-guidance-storage',
        partialize: (state) => ({
          devices: state.devices,
          cadPoints: state.cadPoints,
          conflicts: state.conflicts,
          decisions: state.decisions,
          params: state.params,
          project: state.project,
        }),
      }
    )
  )
);

export function useDevices() {
  return useAppStore((state) => state.devices, shallow);
}

export function useConflicts() {
  return useAppStore((state) => state.conflicts, shallow);
}

export function useParams() {
  return useAppStore((state) => state.params, shallow);
}

export function useView() {
  return useAppStore((state) => state.view, shallow);
}

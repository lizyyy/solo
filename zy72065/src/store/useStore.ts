import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  MonitoringPoint,
  Solution,
  DataConflict,
  CoordinateSystem,
  SolutionFilters,
} from '../types';
import {
  samplePointsNormal,
  samplePointsRework,
  sampleSolutions,
  sampleConflicts,
} from '../data/sampleData';

interface AppState {
  points: MonitoringPoint[];
  solutions: Solution[];
  conflicts: DataConflict[];
  selectedPointId: string | null;
  currentSolutionId: string | null;
  coordinateSystem: CoordinateSystem;
  filters: SolutionFilters;
  searchQuery: string;
  activeTab: 'workspace' | 'solutions' | 'export';
  showImportModal: boolean;
  showConflictModal: boolean;
  conflictPointId: string | null;

  setPoints: (points: MonitoringPoint[]) => void;
  addPoints: (points: MonitoringPoint[]) => void;
  updatePoint: (id: string, updates: Partial<MonitoringPoint>) => void;
  selectPoint: (id: string | null) => void;
  setCoordinateSystem: (system: CoordinateSystem) => void;
  setFilters: (filters: Partial<SolutionFilters>) => void;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: 'workspace' | 'solutions' | 'export') => void;
  setShowImportModal: (show: boolean) => void;
  setShowConflictModal: (show: boolean, pointId?: string) => void;

  saveSolution: (name: string, notes: string, isRework?: boolean) => void;
  loadSolution: (solutionId: string) => void;
  deleteSolution: (solutionId: string) => void;
  setCurrentSolutionId: (id: string | null) => void;

  loadSampleData: (type: 'normal' | 'rework') => void;
  clearAllData: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      points: [],
      solutions: sampleSolutions,
      conflicts: sampleConflicts,
      selectedPointId: null,
      currentSolutionId: null,
      coordinateSystem: 'utm',
      filters: {
        status: ['normal', 'warning', 'danger'],
        source: ['gis', 'tablet', 'excel'],
        dateRange: ['2024-01-01', '2024-12-31'],
      },
      searchQuery: '',
      activeTab: 'workspace',
      showImportModal: false,
      showConflictModal: false,
      conflictPointId: null,

      setPoints: (points) => set({ points }),
      addPoints: (newPoints) =>
        set((state) => ({
          points: [...state.points, ...newPoints],
        })),
      updatePoint: (id, updates) =>
        set((state) => ({
          points: state.points.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      selectPoint: (id) => set({ selectedPointId: id }),
      setCoordinateSystem: (system) => set({ coordinateSystem: system }),
      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setShowImportModal: (show) => set({ showImportModal: show }),
      setShowConflictModal: (show, pointId) =>
        set({ showConflictModal: show, conflictPointId: pointId || null }),

      saveSolution: (name, notes, isRework = false) => {
        const state = get();
        const filteredPointIds = state.points
          .filter((point) => {
            if (!state.filters.status.includes(point.status)) return false;
            if (!state.filters.source.includes(point.source)) return false;
            return true;
          })
          .map((p) => p.id);

        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

        const newSolution: Solution = {
          id: `sol-${Date.now()}`,
          name,
          createdAt: now,
          updatedAt: now,
          createdBy: '何工',
          pointIds: filteredPointIds,
          filters: state.filters,
          coordinateSystem: state.coordinateSystem,
          isRework,
          parentSolutionId: isRework ? state.currentSolutionId : undefined,
          notes,
        };

        set((s) => ({
          solutions: [...s.solutions, newSolution],
          currentSolutionId: newSolution.id,
        }));
      },

      loadSolution: (solutionId) => {
        const solution = get().solutions.find((s) => s.id === solutionId);
        if (solution) {
          set({
            filters: solution.filters,
            coordinateSystem: solution.coordinateSystem,
            currentSolutionId: solutionId,
          });
        }
      },

      deleteSolution: (solutionId) =>
        set((state) => ({
          solutions: state.solutions.filter((s) => s.id !== solutionId),
          currentSolutionId:
            state.currentSolutionId === solutionId
              ? null
              : state.currentSolutionId,
        })),

      setCurrentSolutionId: (id) => set({ currentSolutionId: id }),

      loadSampleData: (type) => {
        if (type === 'normal') {
          set({ points: [...samplePointsNormal], conflicts: [] });
        } else {
          set({
            points: [...samplePointsRework],
            conflicts: [...sampleConflicts],
          });
        }
      },

      clearAllData: () =>
        set({
          points: [],
          selectedPointId: null,
          currentSolutionId: null,
        }),
    }),
    {
      name: 'slope-warning-storage',
      partialize: (state) => ({
        points: state.points,
        solutions: state.solutions,
        conflicts: state.conflicts,
      }),
    }
  )
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SimulationScheme, SchemeState, Attitude } from '../types';

export const useSchemeStore = create<SchemeState & {
  addScheme: (scheme: Omit<SimulationScheme, 'id' | 'createdAt'>) => void;
  removeScheme: (id: string) => void;
  selectScheme: (id: string | null) => void;
  setFilter: (filter: SchemeState['filter']) => void;
  loadSchemeToSimulation: (id: string, setAttitude: (att: Partial<Attitude>) => void, setPressureReversed: (r: boolean) => void, resetSimulation: () => void) => void;
  getFilteredSchemes: () => SimulationScheme[];
}>()(
  persist(
    (set, get) => ({
      schemes: [],
      selectedSchemeId: null,
      filter: 'all',

      addScheme: (schemeData) => {
        const newScheme: SimulationScheme = {
          ...schemeData,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ schemes: [newScheme, ...state.schemes] }));
      },

      removeScheme: (id) => {
        set((state) => ({
          schemes: state.schemes.filter((s) => s.id !== id),
          selectedSchemeId: state.selectedSchemeId === id ? null : state.selectedSchemeId,
        }));
      },

      selectScheme: (id) => set({ selectedSchemeId: id }),

      setFilter: (filter) => set({ filter }),

      loadSchemeToSimulation: (id, setAttitude, setPressureReversed, resetSimulation) => {
        const scheme = get().schemes.find((s) => s.id === id);
        if (scheme) {
          resetSimulation();
          setAttitude(scheme.attitude);
          setPressureReversed(scheme.radiationPressure.isReversed);
        }
      },

      getFilteredSchemes: () => {
        const { schemes, filter } = get();
        if (filter === 'all') return schemes;
        return schemes.filter((s) => s.conclusion === filter);
      },
    }),
    {
      name: 'solar-sail-schemes',
    }
  )
);

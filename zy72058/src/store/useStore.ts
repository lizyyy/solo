import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { HeritageComponent, Scheme, FilterState, CameraState, AppState, AppActions } from '@/types';
import { mockComponents, initialCameraState } from '@/data/mockData';

type Store = AppState & AppActions;

const STORAGE_KEY = 'heritage-component-library';

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      components: mockComponents,
      selectedComponentId: null,
      currentScheme: null,
      schemes: [],
      filter: {},
      cameraState: initialCameraState,
      leftPanelOpen: true,
      rightPanelOpen: true,

      setSelectedComponent: (id: string | null) => {
        set({ selectedComponentId: id });
      },

      updateComponent: (id: string, updates: Partial<HeritageComponent>) => {
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id
              ? { ...c, ...updates, updatedAt: new Date().toISOString() }
              : c
          ),
        }));
      },

      toggleAnomaly: (id: string) => {
        const component = get().components.find((c) => c.id === id);
        if (component) {
          get().updateComponent(id, { isAnomaly: !component.isAnomaly });
        }
      },

      setFilter: (filter: Partial<FilterState>) => {
        set((state) => ({
          filter: { ...state.filter, ...filter },
        }));
      },

      resetFilter: () => {
        set({ filter: {} });
      },

      saveScheme: (name: string, description: string) => {
        const newScheme: Scheme = {
          id: `scheme-${Date.now()}`,
          name,
          description,
          componentIds: get().components.map((c) => c.id),
          cameraState: get().cameraState,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          schemes: [...state.schemes, newScheme],
          currentScheme: newScheme,
        }));
      },

      loadScheme: (schemeId: string) => {
        const scheme = get().schemes.find((s) => s.id === schemeId);
        if (scheme) {
          set({
            currentScheme: scheme,
            cameraState: scheme.cameraState,
          });
        }
      },

      deleteScheme: (schemeId: string) => {
        set((state) => ({
          schemes: state.schemes.filter((s) => s.id !== schemeId),
          currentScheme:
            state.currentScheme?.id === schemeId ? null : state.currentScheme,
        }));
      },

      setCameraState: (state: CameraState) => {
        set({ cameraState: state });
      },

      toggleLeftPanel: () => {
        set((state) => ({ leftPanelOpen: !state.leftPanelOpen }));
      },

      toggleRightPanel: () => {
        set((state) => ({ rightPanelOpen: !state.rightPanelOpen }));
      },

      resetCamera: () => {
        set({ cameraState: initialCameraState });
      },

      exportScreenshot: async () => {
        const html2canvas = (await import('html2canvas')).default;
        const element = document.getElementById('app-container');
        if (element) {
          const canvas = await html2canvas(element, {
            backgroundColor: '#1a1f2e',
            scale: 2,
          });
          const link = document.createElement('a');
          link.download = `古建筑修缮构件库-${new Date().toISOString().slice(0, 10)}.png`;
          link.href = canvas.toDataURL();
          link.click();
        }
      },

      exportData: () => {
        const data = {
          components: get().components,
          schemes: get().schemes,
          exportTime: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const link = document.createElement('a');
        link.download = `古建筑修缮构件库-数据-${new Date().toISOString().slice(0, 10)}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        components: state.components,
        schemes: state.schemes,
        cameraState: state.cameraState,
        filter: state.filter,
        leftPanelOpen: state.leftPanelOpen,
        rightPanelOpen: state.rightPanelOpen,
      }),
    }
  )
);

export const useFilteredComponents = () => {
  const { components, filter } = useStore();
  return components.filter((c) => {
    if (filter.coordinateSystem && c.coordinateSystem !== filter.coordinateSystem) {
      return false;
    }
    if (filter.sourceType && c.sourceType !== filter.sourceType) {
      return false;
    }
    if (filter.isAnomaly !== undefined && c.isAnomaly !== filter.isAnomaly) {
      return false;
    }
    if (filter.status && c.status !== filter.status) {
      return false;
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      return (
        c.name.toLowerCase().includes(searchLower) ||
        c.source.toLowerCase().includes(searchLower) ||
        c.remark.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });
};

export const useCoordinateSystems = () => {
  const components = useStore((state) => state.components);
  return [...new Set(components.map((c) => c.coordinateSystem))];
};

export const useSelectedComponent = () => {
  const { components, selectedComponentId } = useStore();
  return components.find((c) => c.id === selectedComponentId) || null;
};

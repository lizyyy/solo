import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { HeritageComponent, Scheme, FilterState, CameraState, AppState, AppActions } from '@/types';
import { mockComponents, initialCameraState } from '@/data/mockData';
import { exportJSONData, exportReportCSV, calculateStats } from '@/utils/export';

type Store = AppState & AppActions;

export interface ExportRecord {
  id: string;
  type: 'screenshot' | 'json' | 'csv';
  status: 'success' | 'failed';
  timestamp: string;
  filename?: string;
  canvasEngine?: string;
  canvasSize?: string;
  reason?: string;
}

const STORAGE_KEY = 'heritage-component-library-v2';

const initializeComponents = (): HeritageComponent[] => {
  if (typeof window === 'undefined') return mockComponents;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.state?.components && parsed.state.components.length > 0) {
        return parsed.state.components;
      }
    } catch (e) {
      console.warn('Failed to parse stored components, using defaults');
    }
  }
  return JSON.parse(JSON.stringify(mockComponents));
};

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      components: initializeComponents(),
      selectedComponentId: null,
      currentScheme: null,
      schemes: [],
      filter: {},
      cameraState: initialCameraState,
      leftPanelOpen: true,
      rightPanelOpen: true,
      threeCanvasRef: null,
      exportHistory: [],

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
          componentSnapshots: JSON.parse(JSON.stringify(get().components)),
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
          const updates: Partial<Scheme> = {
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({
            currentScheme: { ...scheme, ...updates },
            cameraState: scheme.cameraState,
            components: scheme.componentSnapshots || state.components,
          }));
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

      setThreeCanvas: (canvas: HTMLCanvasElement | null) => {
        set({ threeCanvasRef: canvas });
      },

      exportScreenshot: async () => {
        const findThreeCanvas = (): HTMLCanvasElement | null => {
          const ref = get().threeCanvasRef;
          if (ref && ref instanceof HTMLCanvasElement) {
            return ref;
          }
          const byAttrContains = document.querySelector('canvas[data-engine*="three.js"]') as HTMLCanvasElement | null;
          if (byAttrContains) {
            return byAttrContains;
          }
          const byWebGL = Array.from(document.querySelectorAll('canvas')).find((c) => {
            const gl = c.getContext('webgl2') || c.getContext('webgl');
            return gl !== null;
          }) as HTMLCanvasElement | null;
          return byWebGL || null;
        };

        const canvas = findThreeCanvas();
        if (!canvas) {
          const record: ExportRecord = {
            id: `export-${Date.now()}`,
            type: 'screenshot',
            status: 'failed',
            reason: '无法找到3D画布，场景可能未加载完成',
            timestamp: new Date().toISOString(),
          };
          set((state) => ({ exportHistory: [...state.exportHistory, record] }));
          throw new Error(record.reason);
        }

        try {
          const { exportScreenshotFromCanvas } = await import('@/utils/export');
          const stats = calculateStats(get().components);
          await exportScreenshotFromCanvas(canvas, {
            title: '古建筑修缮构件库 - 3D场景截图',
            stats,
          });
          const record: ExportRecord = {
            id: `export-${Date.now()}`,
            type: 'screenshot',
            status: 'success',
            filename: `古建筑修缮构件库-截图-${new Date().toISOString().slice(0, 10)}.png`,
            canvasEngine: canvas.getAttribute('data-engine') || 'unknown',
            canvasSize: `${canvas.width}x${canvas.height}`,
            timestamp: new Date().toISOString(),
          };
          set((state) => ({ exportHistory: [...state.exportHistory, record] }));
        } catch (e: any) {
          const record: ExportRecord = {
            id: `export-${Date.now()}`,
            type: 'screenshot',
            status: 'failed',
            reason: e?.message || String(e),
            timestamp: new Date().toISOString(),
          };
          set((state) => ({ exportHistory: [...state.exportHistory, record] }));
          throw e;
        }
      },

      exportData: () => {
        exportJSONData({
          components: get().components,
          schemes: get().schemes,
          exportTime: new Date().toISOString(),
        });
      },

      exportCSV: () => {
        exportReportCSV(get().components);
      },

      getStats: () => {
        return calculateStats(get().components);
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
      onRehydrateStorage: () => (state) => {
        console.log('[持久化] 状态已从 localStorage 恢复');
        if (state) {
          console.log('[持久化] 构件数量:', state.components.length);
          console.log('[持久化] 方案数量:', state.schemes.length);
          console.log('[持久化] 异常数量:', state.components.filter(c => c.isAnomaly).length);
        }
      },
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

export const useStats = () => {
  const components = useStore((state) => state.components);
  return calculateStats(components);
};

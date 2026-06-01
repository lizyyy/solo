import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LightPoint, CameraState, PointStatus } from '../types';
import { sampleLightPoints, defaultCameraState } from '../data/sampleData';

interface ProjectState {
  projectName: string;
  lightPoints: LightPoint[];
  selectedPointId: string | null;
  cameraState: CameraState;
  statusFilter: PointStatus | 'all';
  searchQuery: string;
  
  setProjectName: (name: string) => void;
  setLightPoints: (points: LightPoint[]) => void;
  setSelectedPointId: (id: string | null) => void;
  setCameraState: (state: CameraState) => void;
  setStatusFilter: (status: PointStatus | 'all') => void;
  setSearchQuery: (query: string) => void;
  
  updatePointStatus: (id: string, status: PointStatus) => void;
  updatePointRemark: (id: string, remark: string) => void;
  updatePointSuggestion: (id: string, suggestion: string) => void;
  
  addLightPoint: (point: Omit<LightPoint, 'id' | 'createTime' | 'updateTime'>) => void;
  deleteLightPoint: (id: string) => void;
  
  resetToSampleData: () => void;
  exportProject: () => string;
  importProject: (json: string) => boolean;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectName: '剧场灯位安全网 - 默认方案',
      lightPoints: sampleLightPoints,
      selectedPointId: null,
      cameraState: defaultCameraState,
      statusFilter: 'all',
      searchQuery: '',

      setProjectName: (name) => set({ projectName: name }),
      setLightPoints: (points) => set({ lightPoints: points }),
      setSelectedPointId: (id) => set({ selectedPointId: id }),
      setCameraState: (state) => set({ cameraState: state }),
      setStatusFilter: (status) => set({ statusFilter: status }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      updatePointStatus: (id, status) =>
        set((state) => ({
          lightPoints: state.lightPoints.map((p) =>
            p.id === id
              ? { ...p, status, updateTime: new Date().toLocaleString('zh-CN') }
              : p
          ),
        })),

      updatePointRemark: (id, remark) =>
        set((state) => ({
          lightPoints: state.lightPoints.map((p) =>
            p.id === id
              ? { ...p, remark, updateTime: new Date().toLocaleString('zh-CN') }
              : p
          ),
        })),

      updatePointSuggestion: (id, suggestion) =>
        set((state) => ({
          lightPoints: state.lightPoints.map((p) =>
            p.id === id
              ? { ...p, suggestion, updateTime: new Date().toLocaleString('zh-CN') }
              : p
          ),
        })),

      addLightPoint: (point) => {
        const newPoint: LightPoint = {
          ...point,
          id: `lp-${Date.now()}`,
          createTime: new Date().toLocaleString('zh-CN'),
          updateTime: new Date().toLocaleString('zh-CN'),
        };
        set((state) => ({
          lightPoints: [...state.lightPoints, newPoint],
        }));
      },

      deleteLightPoint: (id) =>
        set((state) => ({
          lightPoints: state.lightPoints.filter((p) => p.id !== id),
          selectedPointId: state.selectedPointId === id ? null : state.selectedPointId,
        })),

      resetToSampleData: () =>
        set({
          lightPoints: sampleLightPoints,
          cameraState: defaultCameraState,
          selectedPointId: null,
          projectName: '剧场灯位安全网 - 默认方案',
        }),

      exportProject: () => {
        const state = get();
        return JSON.stringify(
          {
            projectName: state.projectName,
            lightPoints: state.lightPoints,
            cameraState: state.cameraState,
            exportTime: new Date().toLocaleString('zh-CN'),
          },
          null,
          2
        );
      },

      importProject: (json) => {
        try {
          const data = JSON.parse(json);
          if (data.lightPoints && Array.isArray(data.lightPoints)) {
            set({
              projectName: data.projectName || '导入的方案',
              lightPoints: data.lightPoints,
              cameraState: data.cameraState || defaultCameraState,
              selectedPointId: null,
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'theater-light-safety-net',
      partialize: (state) => ({
        projectName: state.projectName,
        lightPoints: state.lightPoints,
        cameraState: state.cameraState,
        statusFilter: state.statusFilter,
        searchQuery: state.searchQuery,
      }),
    }
  )
);

import { create } from 'zustand';
import type { AppStore, ProcessRecord, SchemeData } from '../types';
import { mockPoints, mockPhotos, mockSchemes } from '../data/mockData';

const STORAGE_KEY = 'robot-warehouse-schemes';

const loadSchemes = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : mockSchemes;
  } catch {
    return mockSchemes;
  }
};

const saveSchemes = (schemes: SchemeData[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
  } catch {
    console.error('Failed to save schemes');
  }
};

export const useStore = create<AppStore>((set, get) => ({
  points: mockPoints,
  photos: mockPhotos,
  schemes: loadSchemes(),
  selectedPointId: null,
  activeFloor: 0,
  filterStatus: [],
  filterSource: [],
  cameraPosition: [25, 20, 25],
  cameraTarget: [0, 0, 0],
  showCrossFloorLinks: true,
  panelTab: 'trace',

  setSelectedPoint: (id) => set({ selectedPointId: id }),

  setActiveFloor: (floor) => set({ activeFloor: floor }),

  toggleFilterStatus: (status) =>
    set((state) => ({
      filterStatus: state.filterStatus.includes(status)
        ? state.filterStatus.filter((s) => s !== status)
        : [...state.filterStatus, status],
    })),

  toggleFilterSource: (source) =>
    set((state) => ({
      filterSource: state.filterSource.includes(source)
        ? state.filterSource.filter((s) => s !== source)
        : [...state.filterSource, source],
    })),

  setCameraState: (position, target) =>
    set({ cameraPosition: position, cameraTarget: target }),

  addProcessRecord: (pointId, record) =>
    set((state) => ({
      points: state.points.map((p) =>
        p.id === pointId
          ? {
              ...p,
              processHistory: [
                ...p.processHistory,
                {
                  ...record,
                  id: `proc-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                } as ProcessRecord,
              ],
              updatedAt: new Date().toISOString(),
            }
          : p
      ),
    })),

  resolveConflict: (pointId, resolution, remark) =>
    set((state) => ({
      points: state.points.map((p) => {
        if (p.id !== pointId || !p.conflict) return p;
        const newPoint = { ...p };
        newPoint.conflict = {
          ...p.conflict,
          resolved: true,
          resolution,
        };
        if (resolution === 'use_photo' && p.conflict.photoData.position) {
          newPoint.position = p.conflict.photoData.position;
        }
        if (resolution === 'use_photo' && p.conflict.photoData.deviceName) {
          newPoint.deviceName = p.conflict.photoData.deviceName;
        }
        newPoint.processHistory = [
          ...p.processHistory,
          {
            id: `proc-${Date.now()}`,
            timestamp: new Date().toISOString(),
            operator: '阿乔',
            action: '冲突裁决',
            remark: `${remark} [裁决: ${
              resolution === 'use_system' ? '采用系统数据' :
              resolution === 'use_photo' ? '采用照片数据' : '手动处理'
            }]`,
            status: p.status,
          },
        ];
        newPoint.updatedAt = new Date().toISOString();
        return newPoint;
      }),
    })),

  updatePointStatus: (pointId, status) =>
    set((state) => ({
      points: state.points.map((p) =>
        p.id === pointId
          ? {
              ...p,
              status,
              processHistory: [
                ...p.processHistory,
                {
                  id: `proc-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  operator: '阿乔',
                  action: '状态更新',
                  remark: `状态变更为「${
                    status === 'normal' ? '正常' :
                    status === 'warning' ? '警告' :
                    status === 'error' ? '异常' : '待确认'
                  }」`,
                  status,
                } as ProcessRecord,
              ],
              updatedAt: new Date().toISOString(),
            }
          : p
      ),
    })),

  saveScheme: (name, description, screenshot) => {
    const state = get();
    const newScheme = {
      id: `scheme-${Date.now()}`,
      name,
      description,
      cameraState: {
        position: state.cameraPosition,
        target: state.cameraTarget,
      },
      filterState: {
        status: state.filterStatus,
        source: state.filterSource,
        floor: state.activeFloor,
      },
      pointStates: state.points.reduce((acc, p) => {
        acc[p.id] = { status: p.status, remark: '' };
        return acc;
      }, {} as Record<string, { status: string; remark: string }>),
      screenshot,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newSchemes = [...state.schemes, newScheme];
    saveSchemes(newSchemes);
    set({ schemes: newSchemes });
  },

  loadScheme: (schemeId) => {
    const scheme = get().schemes.find((s) => s.id === schemeId);
    if (!scheme) return;
    set({
      cameraPosition: scheme.cameraState.position,
      cameraTarget: scheme.cameraState.target,
      filterStatus: scheme.filterState.status,
      filterSource: scheme.filterState.source,
      activeFloor: scheme.filterState.floor,
    });
  },

  deleteScheme: (schemeId) => {
    const newSchemes = get().schemes.filter((s) => s.id !== schemeId);
    saveSchemes(newSchemes);
    set({ schemes: newSchemes });
  },

  setPanelTab: (tab) => set({ panelTab: tab }),

  toggleCrossFloorLinks: () =>
    set((state) => ({ showCrossFloorLinks: !state.showCrossFloorLinks })),

  exportScreenshot: () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `仓储任务云_${new Date().toLocaleString('zh-CN').replace(/[/:]/g, '-')}.png`;
    link.href = dataUrl;
    link.click();
    return dataUrl;
  },

  exportReport: () => {
    const state = get();
    const lines: string[] = [];
    lines.push('=== 机器人仓储任务云 巡检报告 ===');
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');
    lines.push(`总点位: ${state.points.length}`);
    lines.push(`正常: ${state.points.filter(p => p.status === 'normal').length}`);
    lines.push(`警告: ${state.points.filter(p => p.status === 'warning').length}`);
    lines.push(`异常: ${state.points.filter(p => p.status === 'error').length}`);
    lines.push(`待确认: ${state.points.filter(p => p.status === 'pending').length}`);
    lines.push('');
    lines.push('=== 详细记录 ===');
    state.points.forEach((p) => {
      lines.push('');
      lines.push(`[${p.status === 'normal' ? '正常' : p.status === 'warning' ? '警告' : p.status === 'error' ? '异常' : '待确认'}] ${p.deviceName}`);
      lines.push(`  位置: ${p.position.floor}层 (${p.position.x.toFixed(1)}, ${p.position.y.toFixed(1)}, ${p.position.z.toFixed(1)})`);
      lines.push(`  来源: ${p.source === 'system' ? '系统导入' : p.source === 'photo' ? '照片补录' : '手动添加'} - ${p.sourceRef}`);
      if (p.anomalyType) {
        lines.push(`  异常类型: ${p.anomalyType}`);
      }
      if (p.conflict && !p.conflict.resolved) {
        lines.push(`  冲突: ${p.conflict.type === 'coordinate' ? '坐标偏移' : p.conflict.type === 'device_name' ? '设备名冲突' : p.conflict.type === 'missing_photo' ? '缺失照片' : '状态冲突'}`);
      }
      const latestProc = p.processHistory[p.processHistory.length - 1];
      if (latestProc) {
        lines.push(`  最新处理: ${latestProc.action} - ${latestProc.remark}`);
      }
    });
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `仓储任务云报告_${new Date().toLocaleString('zh-CN').replace(/[/:]/g, '-')}.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    return text;
  },
}));

export const useFilteredPoints = () => {
  const { points, activeFloor, filterStatus, filterSource } = useStore();
  return points.filter((p) => {
    if (activeFloor !== 0 && p.position.floor !== activeFloor) return false;
    if (filterStatus.length > 0 && !filterStatus.includes(p.status)) return false;
    if (filterSource.length > 0 && !filterSource.includes(p.source)) return false;
    return true;
  });
};

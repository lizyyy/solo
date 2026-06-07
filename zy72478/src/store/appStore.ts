
import { create } from 'zustand';
import type {
  Project,
  BusSwipeRecord,
  RedlineNote,
  HeatmapData,
  ConflictRecord,
  SelfCheckResult,
  OperationLog,
  TodoItem,
  ConflictStatus,
  SelfCheckStatus,
} from '../../shared/types';
import {
  mockProjects,
  mockBusSwipes,
  mockRedlineNotes,
  mockHeatmapData,
  mockConflicts,
  mockSelfChecks,
  mockOperationLogs,
  mockTodos,
} from '../data/mockData';

interface AppState {
  currentProject: Project | null;
  projects: Project[];
  busSwipes: BusSwipeRecord[];
  redlineNotes: RedlineNote[];
  heatmapData: HeatmapData[];
  conflicts: ConflictRecord[];
  selfChecks: SelfCheckResult[];
  operationLogs: OperationLog[];
  todos: TodoItem[];
  selectedHeatmapVersion: string | null;
  currentUser: string;

  setCurrentProject: (project: Project) => void;
  addBusSwipes: (records: BusSwipeRecord[]) => void;
  addRedlineNote: (note: RedlineNote) => void;
  resolveConflict: (id: string, status: ConflictStatus, operator: string) => void;
  runSelfCheck: (type: string) => void;
  runAllSelfChecks: () => void;
  recalculateHeatmap: () => void;
  addOperationLog: (action: string, details: string) => void;
  toggleTodo: (id: string) => void;
  setSelectedHeatmapVersion: (version: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentProject: mockProjects[0],
  projects: mockProjects,
  busSwipes: mockBusSwipes,
  redlineNotes: mockRedlineNotes,
  heatmapData: mockHeatmapData,
  conflicts: mockConflicts,
  selfChecks: mockSelfChecks,
  operationLogs: mockOperationLogs,
  todos: mockTodos,
  selectedHeatmapVersion: mockHeatmapData[1]?.id || null,
  currentUser: '社区书记-周姐',

  setCurrentProject: (project) => set({ currentProject: project }),

  addBusSwipes: (records) => {
    const { currentProject, addOperationLog } = get();
    if (!currentProject) return;

    const newRecords = records.map((r) => ({
      ...r,
      projectId: currentProject.id,
      id: `bus-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }));

    set((state) => ({
      busSwipes: [...state.busSwipes, ...newRecords],
    }));

    addOperationLog('导入公交刷卡数据', `导入${records.length}条公交刷卡记录`);
  },

  addRedlineNote: (note) => {
    const { currentProject, addOperationLog } = get();
    if (!currentProject) return;

    const newNote = {
      ...note,
      projectId: currentProject.id,
      id: `red-${Date.now()}`,
    };

    set((state) => ({
      redlineNotes: [...state.redlineNotes, newNote],
    }));

    addOperationLog('录入红线图备注', `录入区域"${note.areaName}"的红线图备注`);
  },

  resolveConflict: (id, status, operator) => {
    const { addOperationLog } = get();

    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === id
          ? { ...c, status, resolvedBy: operator, resolvedAt: new Date().toISOString() }
          : c
      ),
    }));

    addOperationLog(
      '处理数据冲突',
      `冲突记录${id}已${status === 'confirmed' ? '确认' : '驳回'}，操作人：${operator}`
    );
  },

  runSelfCheck: (type) => {
    const { addOperationLog, busSwipes, heatmapData } = get();

    let result: SelfCheckResult;

    switch (type) {
      case 'duplicate': {
        const duplicates = busSwipes.filter((b) => b.isDuplicate);
        const status: SelfCheckStatus = duplicates.length > 0 ? 'warning' : 'pass';
        result = {
          type: 'duplicate',
          name: '重复导入检测',
          status,
          message:
            duplicates.length > 0
              ? `检测到${duplicates.length}条重复导入记录，可能影响数据准确性`
              : '未检测到重复导入记录',
          details: { duplicateCount: duplicates.length },
        };
        break;
      }
      case 'low_sampling': {
        const latestHeatmap = heatmapData[heatmapData.length - 1];
        const status: SelfCheckStatus = latestHeatmap?.hasLowSampling ? 'error' : 'pass';
        result = {
          type: 'low_sampling',
          name: '夜间采样不足检测',
          status,
          message: latestHeatmap?.hasLowSampling
            ? `${latestHeatmap.lowSamplingAreas?.join('、')}夜间采样量偏低，热力图可能不准确`
            : '所有区域采样量正常',
          details: { areas: latestHeatmap?.lowSamplingAreas || [] },
        };
        break;
      }
      case 'recalculation': {
        result = {
          type: 'recalculation',
          name: '补录后重算验证',
          status: 'pass',
          message: '补录数据后热力图重算正常',
        };
        break;
      }
      case 'export_consistency': {
        result = {
          type: 'export_consistency',
          name: '导出一致性校验',
          status: 'pass',
          message: `导出数据与系统数据一致，共${busSwipes.length}条记录无误`,
        };
        break;
      }
      default:
        return;
    }

    set((state) => ({
      selfChecks: state.selfChecks.map((s) => (s.type === type ? result : s)),
    }));

    addOperationLog('执行自检', `${result.name} - ${result.status === 'pass' ? '通过' : result.status === 'warning' ? '警告' : '异常'}`);
  },

  runAllSelfChecks: () => {
    const { runSelfCheck } = get();
    ['duplicate', 'low_sampling', 'recalculation', 'export_consistency'].forEach((type) => {
      runSelfCheck(type);
    });
  },

  recalculateHeatmap: () => {
    const { currentProject, heatmapData, addOperationLog } = get();
    if (!currentProject) return;

    const lastVersion = heatmapData[heatmapData.length - 1];
    const versionNum = parseFloat(lastVersion?.version.replace('v', '') || '1.0') + 0.1;
    const newVersion = `v${versionNum.toFixed(1)}`;

    const areas = [
      { name: '城西小区A区', baseX: 200, baseY: 200 },
      { name: '城西小区B区', baseX: 350, baseY: 200 },
      { name: '拆迁区东片', baseX: 500, baseY: 350 },
      { name: '人民广场', baseX: 300, baseY: 400 },
    ];

    const data = areas.flatMap((area) =>
      Array.from({ length: 15 }, () => {
        const hour = Math.floor(Math.random() * 24);
        const isNight = hour >= 22 || hour < 6;
        const value = isNight
          ? Math.floor(Math.random() * 30) + 10
          : Math.floor(Math.random() * 80) + 40;
        return {
          x: area.baseX + (Math.random() - 0.5) * 100,
          y: area.baseY + (Math.random() - 0.5) * 100,
          value,
          time: `2026-06-07 ${hour.toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:00`,
          areaName: area.name,
        };
      })
    );

    const newHeatmap: HeatmapData = {
      id: `heat-${Date.now()}`,
      projectId: currentProject.id,
      version: newVersion,
      data,
      hasLowSampling: false,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      heatmapData: [...state.heatmapData, newHeatmap],
      selectedHeatmapVersion: newHeatmap.id,
    }));

    addOperationLog('热力图重算', `补录数据后自动重算，更新至${newVersion}`);
  },

  addOperationLog: (action, details) => {
    const { currentProject, currentUser } = get();
    if (!currentProject) return;

    const log: OperationLog = {
      id: `log-${Date.now()}`,
      projectId: currentProject.id,
      action,
      operator: currentUser,
      details,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      operationLogs: [log, ...state.operationLogs],
    }));
  },

  toggleTodo: (id) => {
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === id ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t
      ),
    }));
  },

  setSelectedHeatmapVersion: (version) => set({ selectedHeatmapVersion: version }),
}));

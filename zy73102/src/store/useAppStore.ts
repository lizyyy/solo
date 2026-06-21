import { create } from 'zustand';

export type BatchStatus = 'pending' | 'running' | 'reviewed' | 'abnormal';
export type UserRole = 'assistant' | 'reviewer';

export interface BatchRun {
  id: string;
  batchId: string;
  runAt: string;
  duration: number;
  materialCount: number;
  abnormalCount: number;
  collisionCount: number;
  version: string;
  remark: string;
}

export interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
  description: string;
  runCount: number;
  lastRunAt?: string;
}

export interface Material {
  id: string;
  name: string;
  type: string;
  spec: string;
}

export interface AppState {
  userRole: UserRole;
  batches: Batch[];
  runs: BatchRun[];
  materials: Material[];
  totalMaterials: number;
  totalAbnormal: number;
  totalCollision: number;
  latestVersion: string;
  isSampleLoaded: boolean;
  setUserRole: (role: UserRole) => void;
  loadSamplePack: () => void;
  rerunBatch: (batchId: string, remark: string) => void;
}

const mockSampleBatches: Batch[] = [
  {
    id: 'batch-001',
    name: 'A区屋面排水系统-标准版',
    status: 'reviewed',
    createdAt: '2026-06-08 09:30:00',
    updatedAt: '2026-06-09 15:42:00',
    description: '包含主排水槽、落水管、雨水斗全套追踪',
    runCount: 3,
    lastRunAt: '2026-06-09 15:42:00',
  },
  {
    id: 'batch-002',
    name: 'B区高层综合体-扩展包',
    status: 'running',
    createdAt: '2026-06-09 10:15:00',
    updatedAt: '2026-06-10 08:20:00',
    description: '超高层屋面虹吸式排水完整链路',
    runCount: 2,
    lastRunAt: '2026-06-10 08:20:00',
  },
  {
    id: 'batch-003',
    name: 'C区地下车库顶板',
    status: 'abnormal',
    createdAt: '2026-06-07 14:00:00',
    updatedAt: '2026-06-08 11:30:00',
    description: '顶板防堵塞排水系统，发现3处材料规格冲突',
    runCount: 4,
    lastRunAt: '2026-06-08 11:30:00',
  },
  {
    id: 'batch-004',
    name: 'D区景观屋顶花园',
    status: 'pending',
    createdAt: '2026-06-10 07:00:00',
    updatedAt: '2026-06-10 07:00:00',
    description: '种植屋面渗排一体系统，待首次执行',
    runCount: 0,
  },
];

const mockSampleRuns: BatchRun[] = [
  { id: 'run-001', batchId: 'batch-001', runAt: '2026-06-09 15:42:00', duration: 128, materialCount: 86, abnormalCount: 0, collisionCount: 0, version: 'v1.2.3', remark: '补备注：修正了雨水斗数量与V1.1的冲突，按设计评审会议最终意见执行' },
  { id: 'run-002', batchId: 'batch-001', runAt: '2026-06-08 16:10:00', duration: 132, materialCount: 84, abnormalCount: 1, collisionCount: 2, version: 'v1.2.2', remark: '补备注：新增HDPE管与铸铁雨水斗的衔接处理意见' },
  { id: 'run-003', batchId: 'batch-001', runAt: '2026-06-08 10:00:00', duration: 145, materialCount: 82, abnormalCount: 3, collisionCount: 4, version: 'v1.2.1', remark: '首次执行' },
  { id: 'run-004', batchId: 'batch-002', runAt: '2026-06-10 08:20:00', duration: 196, materialCount: 142, abnormalCount: 2, collisionCount: 1, version: 'v1.2.3', remark: '补备注：虹吸式排水系统材料清单复核完成' },
  { id: 'run-005', batchId: 'batch-002', runAt: '2026-06-09 14:30:00', duration: 188, materialCount: 138, abnormalCount: 5, collisionCount: 3, version: 'v1.2.2', remark: '首次执行' },
  { id: 'run-006', batchId: 'batch-003', runAt: '2026-06-08 11:30:00', duration: 156, materialCount: 64, abnormalCount: 7, collisionCount: 5, version: 'v1.2.2', remark: '补备注：已定位3处材料规格冲突，待设计方确认' },
  { id: 'run-007', batchId: 'batch-003', runAt: '2026-06-07 18:00:00', duration: 160, materialCount: 64, abnormalCount: 9, collisionCount: 6, version: 'v1.2.1', remark: '首次执行' },
];

export const useAppStore = create<AppState>((set) => ({
  userRole: 'assistant',
  batches: [],
  runs: [],
  materials: [],
  totalMaterials: 0,
  totalAbnormal: 0,
  totalCollision: 0,
  latestVersion: 'v1.2.3',
  isSampleLoaded: false,
  setUserRole: (role) => set({ userRole: role }),
  loadSamplePack: () => {
    const totalM = mockSampleRuns.reduce((sum, r) => sum + r.materialCount, 0);
    const totalA = mockSampleRuns.reduce((sum, r) => sum + r.abnormalCount, 0);
    const totalC = mockSampleRuns.reduce((sum, r) => sum + r.collisionCount, 0);
    set({
      batches: mockSampleBatches,
      runs: mockSampleRuns,
      totalMaterials: totalM,
      totalAbnormal: totalA,
      totalCollision: totalC,
      isSampleLoaded: true,
    });
  },
  rerunBatch: (batchId, remark) => {
    set((state) => {
      const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
      const newRun: BatchRun = {
        id: `run-${Date.now()}`,
        batchId,
        runAt: now,
        duration: Math.floor(100 + Math.random() * 100),
        materialCount: 80 + Math.floor(Math.random() * 60),
        abnormalCount: Math.floor(Math.random() * 5),
        collisionCount: Math.floor(Math.random() * 4),
        version: state.latestVersion,
        remark,
      };
      const updatedBatches = state.batches.map((b) =>
        b.id === batchId
          ? { ...b, status: 'running' as BatchStatus, runCount: b.runCount + 1, lastRunAt: now, updatedAt: now }
          : b
      );
      return {
        runs: [newRun, ...state.runs],
        batches: updatedBatches,
      };
    });
  },
}));

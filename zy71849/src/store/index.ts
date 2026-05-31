import { create } from 'zustand';
import { db } from '@/db';
import { seedDatabase } from '@/db/seed';
import {
  Project,
  DeviceRemark,
  CADPoint,
  SightRecord,
  InspectionItem,
  FlipRecord,
  RemarkHistory,
  MaterialBatch,
  TraceChain,
  Coordinate,
} from '@/types';
import { trackRemarkChange, getRemarkHistories } from '@/utils/historyTracker';
import { createBatch, getOrCreateSightRecords, getBatchReuseInfo } from '@/utils/idempotentChecker';
import { detectPointFlip, createFlipRecord, getFlipRecordsForProject } from '@/utils/flipDetector';
import { buildTraceChain, createTraceLinksForRecord } from '@/utils/traceEngine';
import { generateInspectionItems, getInspectionStats } from '@/utils/inspectionGenerator';

interface AppState {
  initialized: boolean;
  currentUser: string;
  projects: Project[];
  currentProject: Project | null;
  deviceRemarks: DeviceRemark[];
  cadPoints: CADPoint[];
  sightRecords: SightRecord[];
  inspectionItems: InspectionItem[];
  flipRecords: FlipRecord[];
  remarkHistories: Record<string, RemarkHistory[]>;
  materialBatches: MaterialBatch[];
  selectedRecord: SightRecord | null;
  traceChain: TraceChain | null;
  batchReuseInfo: { isReused: boolean; reuseCount: number; originalCreatedAt?: Date } | null;
  loading: boolean;
  error: string | null;
  inspectionStats: {
    total: number;
    confirmed: number;
    pending: number;
    manual: number;
    confirmedCount: number;
    pendingCount: number;
    manualCount: number;
  } | null;

  initialize: () => Promise<void>;
  loadProjects: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  loadProjectData: (projectId: string) => Promise<void>;
  updateDeviceRemark: (
    remarkId: string,
    newContent: string,
    newCoordinate: Coordinate,
    changeReason: string
  ) => Promise<void>;
  loadRemarkHistories: (remarkId: string) => Promise<void>;
  runSightAnalysis: (projectId: string) => Promise<{ isReused: boolean }>;
  selectRecord: (record: SightRecord | null) => Promise<void>;
  loadTraceChain: (recordId: string) => Promise<void>;
  generateInspection: (projectId: string) => Promise<void>;
  clearError: () => void;
  setCurrentUser: (user: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  currentUser: '王经理',
  projects: [],
  currentProject: null,
  deviceRemarks: [],
  cadPoints: [],
  sightRecords: [],
  inspectionItems: [],
  flipRecords: [],
  remarkHistories: {},
  materialBatches: [],
  selectedRecord: null,
  traceChain: null,
  batchReuseInfo: null,
  loading: false,
  error: null,
  inspectionStats: null,

  initialize: async () => {
    if (get().initialized) return;

    set({ loading: true });
    try {
      await seedDatabase();
      set({ initialized: true, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadProjects: async () => {
    set({ loading: true });
    try {
      const projects = await db.projects.orderBy('updatedAt').reverse().toArray();
      set({ projects, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  selectProject: async (projectId: string) => {
    const project = await db.projects.get(projectId);
    if (!project) {
      set({ error: '项目不存在' });
      return;
    }

    set({ currentProject: project });
    await get().loadProjectData(projectId);
  },

  loadProjectData: async (projectId: string) => {
    set({ loading: true });
    try {
      const [remarks, points, records, items, flips, batches] = await Promise.all([
        db.deviceRemarks.where('projectId').equals(projectId).toArray(),
        db.cadPoints.where('projectId').equals(projectId).toArray(),
        db.sightRecords.where('projectId').equals(projectId).toArray(),
        db.inspectionItems.where('projectId').equals(projectId).toArray(),
        getFlipRecordsForProject(projectId),
        db.materialBatches.where('projectId').equals(projectId).toArray(),
      ]);

      const stats = items.length > 0 ? await getInspectionStats(projectId) : null;

      set({
        deviceRemarks: remarks,
        cadPoints: points,
        sightRecords: records,
        inspectionItems: items,
        flipRecords: flips,
        materialBatches: batches,
        inspectionStats: stats,
        loading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  updateDeviceRemark: async (remarkId, newContent, newCoordinate, changeReason) => {
    const state = get();
    const remark = state.deviceRemarks.find((r) => r.id === remarkId);
    if (!remark) return;

    const history = await trackRemarkChange(
      remarkId,
      remark.content,
      newContent,
      remark.coordinate,
      newCoordinate,
      state.currentUser,
      changeReason
    );

    if (history) {
      await db.deviceRemarks.update(remarkId, {
        content: newContent,
        coordinate: newCoordinate,
        modifier: state.currentUser,
        modifiedAt: new Date(),
      });

      const deviceRemarks = state.deviceRemarks.map((r) =>
        r.id === remarkId
          ? { ...r, content: newContent, coordinate: newCoordinate, modifier: state.currentUser, modifiedAt: new Date() }
          : r
      );

      const remarkHistories = { ...state.remarkHistories };
      if (remarkHistories[remarkId]) {
        remarkHistories[remarkId] = [history, ...remarkHistories[remarkId]];
      }

      set({ deviceRemarks, remarkHistories });
    }
  },

  loadRemarkHistories: async (remarkId: string) => {
    const histories = await getRemarkHistories(remarkId);
    set((state) => ({
      remarkHistories: { ...state.remarkHistories, [remarkId]: histories },
    }));
  },

  runSightAnalysis: async (projectId: string) => {
    set({ loading: true });
    const state = get();

    try {
      const devices = state.deviceRemarks;
      const points = state.cadPoints;

      const batch = await createBatch(projectId, devices, points, state.currentUser);

      const calculateSight = (device: DeviceRemark, point: CADPoint): Partial<SightRecord> => {
        const flipResult = detectPointFlip(device, point);

        if (flipResult.hasFlip) {
          createFlipRecord(
            point.id,
            projectId,
            flipResult.flipType,
            flipResult.flipSource,
            `${flipResult.flipType === 'y-flip' ? 'Y轴' : '坐标轴'}坐标符号与设备备注相反，疑似导入时坐标轴翻转`
          );

          return {
            conclusion: '检测到坐标轴翻转，需确认坐标正确性后重新分析',
            sightValue: 0,
            status: 'flip-detected',
            isManualModified: false,
            traceSource: 'cad-point',
          };
        }

        const dx = Math.abs(device.coordinate.x - point.x);
        const dy = Math.abs(device.coordinate.y - point.y);
        const dz = Math.abs(device.coordinate.z - point.z);
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const baseValue = 100 - Math.min(distance / 100, 15);
        const sightValue = Math.max(70, Math.min(100, baseValue));

        const hasMissingData = !device.coordinate.x || !device.coordinate.y || !device.coordinate.z;

        if (hasMissingData) {
          return {
            conclusion: '设备备注坐标缺失，待补充完整后分析',
            sightValue: 0,
            status: 'pending',
            isManualModified: false,
            traceSource: 'device-remark',
          };
        }

        return {
          conclusion: '视线良好，无遮挡，可视角度符合标准',
          sightValue,
          status: 'confirmed',
          isManualModified: false,
          traceSource: 'device-remark',
        };
      };

      const { records, isReused } = await getOrCreateSightRecords(projectId, batch, calculateSight);

      for (const record of records) {
        const device = devices.find((d) => d.deviceCode === record.deviceCode);
        const point = points.find((p) => p.pointCode === record.pointCode);

        if (device || point) {
          const manualSnapshot = record.isManualModified
            ? {
                modifier: record.manualModifier,
                reason: record.manualReason,
                modifiedAt: record.manualModifiedAt,
              }
            : undefined;

          await createTraceLinksForRecord(record, device?.id, point?.id, manualSnapshot);
        }
      }

      const reuseInfo = await getBatchReuseInfo(batch.id);

      const flips = await getFlipRecordsForProject(projectId);

      set({
        sightRecords: records,
        flipRecords: flips,
        batchReuseInfo: reuseInfo,
        loading: false,
      });

      return { isReused };
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return { isReused: false };
    }
  },

  selectRecord: async (record: SightRecord | null) => {
    set({ selectedRecord: record });
    if (record) {
      await get().loadTraceChain(record.id);
    } else {
      set({ traceChain: null });
    }
  },

  loadTraceChain: async (recordId: string) => {
    const record = get().sightRecords.find((r) => r.id === recordId);
    if (!record) return;

    const chain = await buildTraceChain(record);
    set({ traceChain: chain });
  },

  generateInspection: async (projectId: string) => {
    set({ loading: true });
    try {
      const records = get().sightRecords;
      const items = await generateInspectionItems(projectId, records);
      const stats = await getInspectionStats(projectId);

      set({ inspectionItems: items, inspectionStats: stats, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  clearError: () => set({ error: null }),

  setCurrentUser: (user: string) => set({ currentUser: user }),
}));

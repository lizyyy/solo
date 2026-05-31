import { create } from 'zustand';
import type {
  ShiftRecord,
  WorkLog,
  WorkLogVersion,
  MaintenanceOrder,
  ChangeNotification,
  VersionDiff,
} from '@/types';
import {
  getAllFromStore,
  getFromStore,
  addToStore,
  putToStore,
  deleteFromStore,
  getWorkLogVersions,
  getUnreadNotifications,
} from '@/utils/db';
import {
  diffVersions,
  analyzeDiffImpact,
  hasSignificantChanges,
  getChangeSummary,
  parseWorkLogContent,
} from '@/utils/changeDetection';
import { generateId, readFileAsText } from '@/utils/helpers';

interface RecordsState {
  shiftRecords: ShiftRecord[];
  workLogs: WorkLog[];
  maintenanceOrders: MaintenanceOrder[];
  notifications: ChangeNotification[];
  selectedShiftRecord: ShiftRecord | null;
  selectedWorkLog: WorkLog | null;
  selectedMaintenanceOrder: MaintenanceOrder | null;
  loading: boolean;
  error: string | null;

  loadShiftRecords: () => Promise<void>;
  loadWorkLogs: () => Promise<void>;
  loadMaintenanceOrders: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  loadSelectedShiftRecord: (id: string) => Promise<void>;
  loadSelectedWorkLog: (id: string) => Promise<void>;
  loadSelectedMaintenanceOrder: (id: string) => Promise<void>;
  getWorkLogVersions: (workLogId: string) => Promise<WorkLogVersion[]>;

  addShiftRecord: (data: Omit<ShiftRecord, 'id' | 'createdAt'>) => Promise<string>;
  addWorkLog: (equipmentId: string, content: string, uploadedBy: string) => Promise<string>;
  addWorkLogVersion: (
    workLogId: string,
    content: string,
    uploadedBy: string,
    changeDescription?: string
  ) => Promise<{ workLogId: string; newVersion: number; notification?: ChangeNotification }>;
  addMaintenanceOrder: (
    data: Omit<MaintenanceOrder, 'id'>
  ) => Promise<string>;
  updateMaintenanceOrder: (
    id: string,
    updates: Partial<MaintenanceOrder>
  ) => Promise<void>;
  uploadWorkLogFile: (
    file: File,
    equipmentId: string,
    uploadedBy: string,
    isSupplementary?: boolean
  ) => Promise<{ workLogId: string; newVersion: number; notification?: ChangeNotification }>;

  markNotificationReviewed: (id: string, reviewedBy: string) => Promise<void>;
  getVersionDiffs: (
    workLogId: string,
    oldVersion: number,
    newVersion: number
  ) => Promise<VersionDiff[]>;

  clearSelections: () => void;
  clearError: () => void;
}

export const useRecordsStore = create<RecordsState>((set, get) => ({
  shiftRecords: [],
  workLogs: [],
  maintenanceOrders: [],
  notifications: [],
  selectedShiftRecord: null,
  selectedWorkLog: null,
  selectedMaintenanceOrder: null,
  loading: false,
  error: null,

  loadShiftRecords: async () => {
    set({ loading: true });
    try {
      const records = await getAllFromStore('shiftRecords', 'recordTime');
      set({ shiftRecords: records.reverse(), loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadWorkLogs: async () => {
    set({ loading: true });
    try {
      const logs = await getAllFromStore('workLogs');
      const logsWithVersions = await Promise.all(
        logs.map(async (log) => ({
          ...log,
          versions: await getWorkLogVersions(log.id),
        }))
      );
      logsWithVersions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      set({ workLogs: logsWithVersions, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadMaintenanceOrders: async () => {
    set({ loading: true });
    try {
      const orders = await getAllFromStore('maintenanceOrders');
      orders.sort((a, b) => b.startTime - a.startTime);
      set({ maintenanceOrders: orders, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadNotifications: async () => {
    try {
      const notifications = await getUnreadNotifications();
      set({ notifications });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadSelectedShiftRecord: async (id: string) => {
    set({ loading: true });
    try {
      const record = await getFromStore('shiftRecords', id);
      set({ selectedShiftRecord: record || null, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadSelectedWorkLog: async (id: string) => {
    set({ loading: true });
    try {
      const log = await getFromStore('workLogs', id);
      if (log) {
        const versions = await getWorkLogVersions(id);
        set({ selectedWorkLog: { ...log, versions }, loading: false });
      } else {
        set({ selectedWorkLog: null, loading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadSelectedMaintenanceOrder: async (id: string) => {
    set({ loading: true });
    try {
      const order = await getFromStore('maintenanceOrders', id);
      set({ selectedMaintenanceOrder: order || null, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  getWorkLogVersions: async (workLogId: string) => {
    return getWorkLogVersions(workLogId);
  },

  addShiftRecord: async (data) => {
    const record: ShiftRecord = {
      ...data,
      id: generateId('shift'),
      createdAt: Date.now(),
    };
    const id = await addToStore('shiftRecords', record);
    get().loadShiftRecords();
    return id;
  },

  addWorkLog: async (equipmentId, content, uploadedBy) => {
    const parsedData = parseWorkLogContent(content);
    const workLogId = generateId('log');

    const version: WorkLogVersion = {
      id: generateId('ver'),
      workLogId,
      version: 1,
      uploadSource: 'original',
      content,
      parsedData,
      uploadedAt: Date.now(),
      uploadedBy,
    };

    const workLog: WorkLog = {
      id: workLogId,
      equipmentId,
      currentVersion: 1,
      versions: [version],
      createdAt: Date.now(),
    };

    await addToStore('workLogVersions', version);
    const id = await addToStore('workLogs', workLog);
    get().loadWorkLogs();
    return id;
  },

  addWorkLogVersion: async (workLogId, content, uploadedBy, changeDescription) => {
    const workLog = await getFromStore('workLogs', workLogId);
    if (!workLog) {
      throw new Error('工况日志不存在');
    }

    const existingVersions = await getWorkLogVersions(workLogId);
    const latestVersion = existingVersions[0];
    const newVersionNum = workLog.currentVersion + 1;

    const parsedData = parseWorkLogContent(content);

    const newVersion: WorkLogVersion = {
      id: generateId('ver'),
      workLogId,
      version: newVersionNum,
      operator: uploadedBy,
      timestamp: Date.now(),
      content,
      parsedData,
      uploadedAt: Date.now(),
      uploadedBy,
      changeDescription: changeDescription || '补传旧版本数据',
    };

    let notification: ChangeNotification | undefined;

    if (latestVersion) {
      const diffs = diffVersions(latestVersion, newVersion);
      const analysisRuns = await getAllFromStore('analysisRuns');
      const allConclusions = analysisRuns.flatMap((r) => r.conclusions);
      const analyzedDiffs = analyzeDiffImpact(
        diffs,
        allConclusions,
        latestVersion.parsedData,
        newVersion.parsedData
      );

      if (hasSignificantChanges(analyzedDiffs)) {
        const affectedConclusionIds = new Set(
          analyzedDiffs.flatMap((d) => d.affectsConclusionIds)
        );

        notification = {
          id: generateId('notif'),
          workLogId,
          workLogVersion: newVersionNum,
          timestamp: Date.now(),
          operator: uploadedBy,
          diffs: analyzedDiffs,
          diffSummary: getChangeSummary(analyzedDiffs),
          affectedConclusionIds: Array.from(affectedConclusionIds),
          reviewed: false,
          reviewedBy: null,
          reviewedAt: null,
        };

        await addToStore('notifications', notification);
      }
    }

    await addToStore('workLogVersions', newVersion);
    await putToStore('workLogs', {
      ...workLog,
      currentVersion: newVersionNum,
      hasDataChange: true,
    });

    get().loadWorkLogs();
    get().loadNotifications();

    return {
      workLogId,
      newVersion: newVersionNum,
      notification,
    };
  },

  addMaintenanceOrder: async (data) => {
    const order: MaintenanceOrder = {
      ...data,
      id: generateId('maint'),
    };
    const id = await addToStore('maintenanceOrders', order);
    get().loadMaintenanceOrders();
    return id;
  },

  updateMaintenanceOrder: async (id, updates) => {
    const existing = await getFromStore('maintenanceOrders', id);
    if (!existing) {
      throw new Error('维修单不存在');
    }
    await putToStore('maintenanceOrders', { ...existing, ...updates });
    get().loadMaintenanceOrders();
  },

  uploadWorkLogFile: async (file, equipmentId, uploadedBy, isSupplementary = false) => {
    const content = await readFileAsText(file);

    let existingLog = get().workLogs.find((l) => l.equipmentId === equipmentId);
    if (!existingLog) {
      const logs = await getAllFromStore('workLogs');
      existingLog = logs.find((l) => l.equipmentId === equipmentId);
    }

    if (existingLog) {
      return get().addWorkLogVersion(existingLog.id, content, uploadedBy, isSupplementary ? '补传旧版本数据' : '更新数据');
    } else {
      const workLogId = await get().addWorkLog(equipmentId, content, uploadedBy);
      return { workLogId, newVersion: 1 };
    }
  },

  markNotificationReviewed: async (id, reviewedBy) => {
    const notification = await getFromStore('notifications', id);
    if (!notification) return;

    await putToStore('notifications', {
      ...notification,
      reviewed: true,
      reviewedBy,
      reviewedAt: Date.now(),
    });

    get().loadNotifications();
  },

  getVersionDiffs: async (workLogId, oldVersion, newVersion) => {
    const versions = await getWorkLogVersions(workLogId);
    const oldVer = versions.find((v) => v.version === oldVersion);
    const newVer = versions.find((v) => v.version === newVersion);

    if (!oldVer || !newVer) {
      return [];
    }

    const diffs = diffVersions(oldVer, newVer);
    const analysisRuns = await getAllFromStore('analysisRuns');
    const allConclusions = analysisRuns.flatMap((r) => r.conclusions);

    return analyzeDiffImpact(
      diffs,
      allConclusions,
      oldVer.parsedData,
      newVer.parsedData
    );
  },

  clearSelections: () => {
    set({
      selectedShiftRecord: null,
      selectedWorkLog: null,
      selectedMaintenanceOrder: null,
    });
  },

  clearError: () => set({ error: null }),
}));

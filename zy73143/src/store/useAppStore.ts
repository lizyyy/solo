import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BuoyLog,
  SpatialMark,
  Anomaly,
  ChangeLog,
  ImportResult,
  ChangeAction,
  ChangeSourceType,
} from '../types';
import {
  generateId,
  detectBuoyLogAnomalies,
  isDuplicateLog,
  mergeDuplicateLog,
} from '../utils/anomalyUtils';
import { mockBuoyLogs, mockSpatialMarks, mockAnomalies, mockChangeLogs } from '../data/mockData';

interface AppState {
  buoyLogs: BuoyLog[];
  spatialMarks: SpatialMark[];
  anomalies: Anomaly[];
  changeLogs: ChangeLog[];
  selectedLogId: string | null;
  selectedMarkId: string | null;
  selectedAnomalyId: string | null;
  showLogDetail: boolean;
  showMarkDetail: boolean;
  showImportModal: boolean;
  showAnomalyDetail: boolean;

  addBuoyLog: (log: Omit<BuoyLog, 'id' | 'createdAt' | 'updatedAt'>) => BuoyLog;
  updateBuoyLog: (id: string, updates: Partial<BuoyLog>) => void;
  confirmBuoyLog: (id: string, confirmer: string, remark?: string) => void;
  importBuoyLogs: (
    logs: Omit<BuoyLog, 'id' | 'createdAt' | 'updatedAt' | 'importBatch' | 'isConfirmed' | 'remark'>[],
    batchName: string
  ) => ImportResult;

  addSpatialMark: (mark: Omit<SpatialMark, 'id' | 'createdAt' | 'updatedAt'>) => SpatialMark;
  updateSpatialMark: (id: string, updates: Partial<SpatialMark>) => void;
  markAsAbnormal: (id: string, remark: string) => void;

  addAnomaly: (anomaly: Omit<Anomaly, 'id' | 'detectedAt'>) => void;
  resolveAnomaly: (id: string, remark: string, resolver: string) => void;

  addChangeLog: (
    sourceType: ChangeSourceType,
    sourceId: string,
    action: ChangeAction,
    beforeData: Record<string, unknown> | null,
    afterData: Record<string, unknown> | null,
    operator: string,
    remark?: string
  ) => void;

  setSelectedLogId: (id: string | null) => void;
  setSelectedMarkId: (id: string | null) => void;
  setSelectedAnomalyId: (id: string | null) => void;
  setShowLogDetail: (show: boolean) => void;
  setShowMarkDetail: (show: boolean) => void;
  setShowImportModal: (show: boolean) => void;
  setShowAnomalyDetail: (show: boolean) => void;

  getLogById: (id: string) => BuoyLog | undefined;
  getMarkById: (id: string) => SpatialMark | undefined;
  getAnomalyById: (id: string) => Anomaly | undefined;
  getAnomaliesBySourceId: (sourceId: string) => Anomaly[];
  getChangesBySourceId: (sourceType: ChangeSourceType, sourceId: string) => ChangeLog[];

  resetToMockData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      buoyLogs: mockBuoyLogs,
      spatialMarks: mockSpatialMarks,
      anomalies: mockAnomalies,
      changeLogs: mockChangeLogs,
      selectedLogId: null,
      selectedMarkId: null,
      selectedAnomalyId: null,
      showLogDetail: false,
      showMarkDetail: false,
      showImportModal: false,
      showAnomalyDetail: false,

      addBuoyLog: (logData) => {
        const now = new Date().toISOString();
        const newLog: BuoyLog = {
          ...logData,
          id: generateId('log'),
          createdAt: now,
          updatedAt: now,
        };

        const anomalies = detectBuoyLogAnomalies(newLog, get().buoyLogs);
        anomalies.forEach((a) => {
          if (a.hasAnomaly && a.type && a.severity && a.description) {
            get().addAnomaly({
              sourceType: 'buoy_log',
              sourceId: newLog.id,
              type: a.type,
              description: a.description,
              severity: a.severity,
              isResolved: false,
            });
          }
        });

        set((state) => ({
          buoyLogs: [...state.buoyLogs, newLog],
        }));

        get().addChangeLog('buoy_log', newLog.id, 'create', null, logData, '系统', '新增浮标日志');

        return newLog;
      },

      updateBuoyLog: (id, updates) => {
        const log = get().getLogById(id);
        if (!log) return;

        const beforeData = { ...log };
        const updatedLog = { ...log, ...updates, updatedAt: new Date().toISOString() };

        set((state) => ({
          buoyLogs: state.buoyLogs.map((l) => (l.id === id ? updatedLog : l)),
        }));

        get().addChangeLog(
          'buoy_log',
          id,
          'update',
          beforeData as Record<string, unknown>,
          updates as Record<string, unknown>,
          '用户',
          '更新浮标日志'
        );
      },

      confirmBuoyLog: (id, confirmer, remark) => {
        const log = get().getLogById(id);
        if (!log) return;

        const beforeData = { isConfirmed: log.isConfirmed, remark: log.remark };
        const updates: Partial<BuoyLog> = {
          isConfirmed: true,
          confirmedAt: new Date().toISOString(),
          confirmer,
          updatedAt: new Date().toISOString(),
        };
        if (remark !== undefined) {
          updates.remark = remark;
        }

        const updatedLog = { ...log, ...updates };

        set((state) => ({
          buoyLogs: state.buoyLogs.map((l) => (l.id === id ? updatedLog : l)),
        }));

        get().addChangeLog(
          'buoy_log',
          id,
          'confirm',
          beforeData as Record<string, unknown>,
          { isConfirmed: true, remark, confirmer } as Record<string, unknown>,
          confirmer,
          '人工确认数据'
        );
      },

      importBuoyLogs: (logs, batchName) => {
        const result: ImportResult = {
          total: logs.length,
          newCount: 0,
          duplicateCount: 0,
          anomalyCount: 0,
          skippedWithRemark: 0,
          skippedWithConfirm: 0,
          supplementCount: 0,
          batchName,
        };

        const now = new Date().toISOString();
        const newLogs: BuoyLog[] = [];
        const updatedLogs: BuoyLog[] = [];

        logs.forEach((logData) => {
          const fullLogData = {
            ...logData,
            importBatch: batchName,
            remark: '',
            isConfirmed: false,
          };

          const existingLog = isDuplicateLog(fullLogData as BuoyLog, get().buoyLogs);

          if (existingLog) {
            result.duplicateCount++;

            const mergeResult = mergeDuplicateLog(
              existingLog,
              fullLogData as BuoyLog
            );

            if (mergeResult.preservedRemark) {
              result.skippedWithRemark++;
            }
            if (mergeResult.preservedConfirm) {
              result.skippedWithConfirm++;
            }

            if (mergeResult.hasChanges) {
              result.supplementCount++;
              updatedLogs.push(mergeResult.merged);

              get().addChangeLog(
                'buoy_log',
                existingLog.id,
                'supplement',
                mergeResult.beforeData,
                mergeResult.afterData,
                '系统',
                `补录数据（批次 ${batchName}）：更新了 ${mergeResult.changedFields.length} 个字段`
              );
            }

            const anomalies = detectBuoyLogAnomalies(
              mergeResult.merged,
              get().buoyLogs
            );
            const existingAnomalies = get().anomalies.filter(
              (a) => a.sourceType === 'buoy_log' && a.sourceId === existingLog.id && !a.isResolved
            );

            anomalies.forEach((a) => {
              if (a.hasAnomaly && a.type && a.severity && a.description) {
                const alreadyHas = existingAnomalies.some((ea) => ea.type === a.type);
                if (!alreadyHas) {
                  result.anomalyCount++;
                  get().addAnomaly({
                    sourceType: 'buoy_log',
                    sourceId: existingLog.id,
                    type: a.type,
                    description: a.description,
                    severity: a.severity,
                    isResolved: false,
                  });
                }
              }
            });
          } else {
            const newLog: BuoyLog = {
              ...fullLogData,
              id: generateId('log'),
              createdAt: now,
              updatedAt: now,
            };

            const anomalies = detectBuoyLogAnomalies(newLog, [
              ...get().buoyLogs,
              ...newLogs,
            ]);
            if (anomalies.length > 0) {
              result.anomalyCount += anomalies.length;
              anomalies.forEach((a) => {
                if (a.hasAnomaly && a.type && a.severity && a.description) {
                  get().addAnomaly({
                    sourceType: 'buoy_log',
                    sourceId: newLog.id,
                    type: a.type,
                    description: a.description,
                    severity: a.severity,
                    isResolved: false,
                  });
                }
              });
            }

            newLogs.push(newLog);
            result.newCount++;

            get().addChangeLog(
              'buoy_log',
              newLog.id,
              'create',
              null,
              fullLogData as Record<string, unknown>,
              '系统',
              `导入新增（批次 ${batchName}）`
            );
          }
        });

        set((state) => ({
          buoyLogs: [
            ...state.buoyLogs.map((l) => {
              const updated = updatedLogs.find((u) => u.id === l.id);
              return updated || l;
            }),
            ...newLogs,
          ],
        }));

        get().addChangeLog(
          'buoy_log',
          'batch-import',
          'import',
          null,
          {
            count: result.newCount,
            duplicate: result.duplicateCount,
            supplement: result.supplementCount,
            anomaly: result.anomalyCount,
            batch: batchName,
          } as Record<string, unknown>,
          '系统',
          `批量导入 ${batchName}：新增 ${result.newCount} 条，重复 ${result.duplicateCount} 条，补录 ${result.supplementCount} 条，异常 ${result.anomalyCount} 条`
        );

        return result;
      },

      addSpatialMark: (markData) => {
        const now = new Date().toISOString();
        const newMark: SpatialMark = {
          ...markData,
          id: generateId('mark'),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          spatialMarks: [...state.spatialMarks, newMark],
        }));

        get().addChangeLog(
          'spatial_mark',
          newMark.id,
          'create',
          null,
          markData as Record<string, unknown>,
          '用户',
          '新增空间标注'
        );

        return newMark;
      },

      updateSpatialMark: (id, updates) => {
        const mark = get().getMarkById(id);
        if (!mark) return;

        const beforeData = { ...mark };
        const updatedMark = { ...mark, ...updates, updatedAt: new Date().toISOString() };

        set((state) => ({
          spatialMarks: state.spatialMarks.map((m) => (m.id === id ? updatedMark : m)),
        }));

        get().addChangeLog(
          'spatial_mark',
          id,
          'update',
          beforeData as Record<string, unknown>,
          updates as Record<string, unknown>,
          '用户',
          '更新空间标注'
        );
      },

      markAsAbnormal: (id, remark) => {
        const mark = get().getMarkById(id);
        if (!mark) return;

        const beforeData = { status: mark.status, remark: mark.remark };
        const updatedMark = {
          ...mark,
          status: 'abnormal' as const,
          remark: mark.remark ? `${mark.remark}\n${remark}` : remark,
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          spatialMarks: state.spatialMarks.map((m) => (m.id === id ? updatedMark : m)),
        }));

        get().addChangeLog(
          'spatial_mark',
          id,
          'mark_abnormal',
          beforeData as Record<string, unknown>,
          { status: 'abnormal', remark } as Record<string, unknown>,
          '用户',
          '标记为异常点位'
        );
      },

      addAnomaly: (anomalyData) => {
        const newAnomaly: Anomaly = {
          ...anomalyData,
          id: generateId('anomaly'),
          detectedAt: new Date().toISOString(),
        };

        set((state) => ({
          anomalies: [...state.anomalies, newAnomaly],
        }));

        return newAnomaly;
      },

      resolveAnomaly: (id, remark, resolver) => {
        const anomaly = get().getAnomalyById(id);
        if (!anomaly) return;

        const beforeData = { isResolved: anomaly.isResolved, resolvedRemark: anomaly.resolvedRemark };
        const updatedAnomaly: Anomaly = {
          ...anomaly,
          isResolved: true,
          resolvedRemark: remark,
          resolvedBy: resolver,
          resolvedAt: new Date().toISOString(),
        };

        set((state) => ({
          anomalies: state.anomalies.map((a) => (a.id === id ? updatedAnomaly : a)),
        }));

        get().addChangeLog(
          'anomaly',
          id,
          'resolve',
          beforeData as Record<string, unknown>,
          { isResolved: true, resolvedRemark: remark, resolvedBy: resolver } as Record<string, unknown>,
          resolver,
          '处理异常'
        );
      },

      addChangeLog: (sourceType, sourceId, action, beforeData, afterData, operator, remark) => {
        const changeLog: ChangeLog = {
          id: generateId('change'),
          sourceType,
          sourceId,
          action,
          beforeData,
          afterData,
          operator,
          remark,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          changeLogs: [changeLog, ...state.changeLogs],
        }));
      },

      setSelectedLogId: (id) => set({ selectedLogId: id }),
      setSelectedMarkId: (id) => set({ selectedMarkId: id }),
      setSelectedAnomalyId: (id) => set({ selectedAnomalyId: id }),
      setShowLogDetail: (show) => set({ showLogDetail: show }),
      setShowMarkDetail: (show) => set({ showMarkDetail: show }),
      setShowImportModal: (show) => set({ showImportModal: show }),
      setShowAnomalyDetail: (show) => set({ showAnomalyDetail: show }),

      getLogById: (id) => get().buoyLogs.find((l) => l.id === id),
      getMarkById: (id) => get().spatialMarks.find((m) => m.id === id),
      getAnomalyById: (id) => get().anomalies.find((a) => a.id === id),
      getAnomaliesBySourceId: (sourceId) =>
        get().anomalies.filter((a) => a.sourceId === sourceId),
      getChangesBySourceId: (sourceType, sourceId) =>
        get().changeLogs.filter((c) => c.sourceType === sourceType && c.sourceId === sourceId),

      resetToMockData: () => {
        set({
          buoyLogs: mockBuoyLogs,
          spatialMarks: mockSpatialMarks,
          anomalies: mockAnomalies,
          changeLogs: mockChangeLogs,
        });
      },
    }),
    {
      name: 'seagrass-survey-storage',
      partialize: (state) => ({
        buoyLogs: state.buoyLogs,
        spatialMarks: state.spatialMarks,
        anomalies: state.anomalies,
        changeLogs: state.changeLogs,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).resetSeagrassData = () => {
    useAppStore.getState().resetToMockData();
  };
}

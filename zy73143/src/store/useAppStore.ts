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
  detectLatLngSwapped,
  type MergeResult,
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
          batchName,
          filledFieldsCount: 0,
          preservedConfirmedCount: 0,
          mergedCount: 0,
        };

        const now = new Date().toISOString();
        const newLogs: BuoyLog[] = [];
        const mergedUpdates: { log: BuoyLog; mergeInfo: MergeResult; originalBefore: BuoyLog }[] = [];

        const currentAllLogs = get().buoyLogs;

        logs.forEach((logData) => {
          const fullLogData = {
            ...logData,
            importBatch: batchName,
            remark: '',
            isConfirmed: false,
          } as BuoyLog;

          const hasLatLngSwap = (() => {
            const { longitude, latitude } = fullLogData;
            const chinaLngMin = 73;
            const chinaLngMax = 135;
            const chinaLatMin = 18;
            const chinaLatMax = 54;
            const lngInRange = longitude >= chinaLngMin && longitude <= chinaLngMax;
            const latInRange = latitude >= chinaLatMin && latitude <= chinaLatMax;
            const swappedLngInRange = latitude >= chinaLngMin && latitude <= chinaLngMax;
            const swappedLatInRange = longitude >= chinaLatMin && longitude <= chinaLatMax;
            if (!lngInRange && !latInRange && swappedLngInRange && swappedLatInRange) return true;
            if (Math.abs(longitude) < 60 && Math.abs(latitude) > 90) return true;
            return false;
          })();

          const existingLog = isDuplicateLog(fullLogData, currentAllLogs);

          if (existingLog) {
            result.duplicateCount++;
            const originalBefore = { ...existingLog };

            const mergeInfo = mergeDuplicateLog(
              existingLog,
              fullLogData,
              batchName
            );

            mergeInfo.merged._lastMergedAt = now;
            mergeInfo.merged._mergedCount = (existingLog._mergedCount || 1) + 1;

            if (mergeInfo.preservedRemark) {
              result.skippedWithRemark++;
            }
            if (mergeInfo.preservedConfirmed) {
              result.preservedConfirmedCount++;
            }
            result.filledFieldsCount += mergeInfo.filledFields.length;

            if (
              mergeInfo.changedFields.length > 0 ||
              mergeInfo.filledFields.length > 0 ||
              mergeInfo.preservedFields.length > 0
            ) {
              result.mergedCount++;
            }

            if (hasLatLngSwap) {
              const existingAnomalies = get().anomalies.filter(
                (a) => a.sourceId === existingLog.id && !a.isResolved
              );
              const hasExistingSwap = existingAnomalies.some((a) => a.type === 'latlng_swapped');
              if (!hasExistingSwap) {
                result.anomalyCount++;
              }
            }

            mergedUpdates.push({ log: mergeInfo.merged, mergeInfo, originalBefore });
          } else {
            const newLog: BuoyLog = {
              ...fullLogData,
              id: generateId('log'),
              createdAt: now,
              updatedAt: now,
              _importBatches: [batchName],
              _mergedCount: 1,
            };

            if (hasLatLngSwap) {
              result.anomalyCount++;
            }

            const anomalies = detectBuoyLogAnomalies(newLog, [
              ...currentAllLogs,
              ...newLogs,
            ]);
            if (anomalies.length > 0) {
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
          }
        });

        if (mergedUpdates.length > 0) {
          mergedUpdates.forEach(({ log, mergeInfo, originalBefore }) => {
            const hasRealChanges =
              mergeInfo.changedFields.length > 0 || mergeInfo.filledFields.length > 0;

            if (detectLatLngSwapped(log) || mergeInfo.changedFields.length > 0) {
              const detected = detectBuoyLogAnomalies(log, currentAllLogs);
              detected.forEach((a) => {
                if (a.hasAnomaly && a.type && a.severity && a.description) {
                  const existing = get().anomalies.find(
                    (an) =>
                      an.sourceId === log.id &&
                      an.type === a.type &&
                      !an.isResolved
                  );
                  if (!existing) {
                    get().addAnomaly({
                      sourceType: 'buoy_log',
                      sourceId: log.id,
                      type: a.type,
                      description: a.description,
                      severity: a.severity,
                      isResolved: false,
                    });
                  }
                }
              });
            }

            const beforeSnapshot: Record<string, unknown> = {};
            const afterSnapshot: Record<string, unknown> = {};

            [...mergeInfo.changedFields, ...mergeInfo.filledFields, ...mergeInfo.preservedFields].forEach(
              (field) => {
                beforeSnapshot[field] = (originalBefore as any)[field];
                afterSnapshot[field] = (log as any)[field];
              }
            );

            const changeRemark = [
              mergeInfo.changedFields.length > 0 && `更新: ${mergeInfo.changedFields.join(', ')}`,
              mergeInfo.filledFields.length > 0 && `补齐: ${mergeInfo.filledFields.join(', ')}`,
              mergeInfo.preservedRemark && `保留备注: "${originalBefore.remark}"`,
              mergeInfo.preservedConfirmed && `保留确认状态(${originalBefore.confirmer || ''})`,
            ]
              .filter(Boolean)
              .join(' | ');

            get().addChangeLog(
              'buoy_log',
              log.id,
              'update',
              beforeSnapshot,
              afterSnapshot,
              '系统',
              `补录合并 [${batchName}] ${changeRemark}`
            );
          });
        }

        set((state) => ({
          buoyLogs: [
            ...state.buoyLogs.map((l) => {
              const merged = mergedUpdates.find((m) => m.log.id === l.id);
              return merged ? merged.log : l;
            }),
            ...newLogs,
          ],
        }));

        newLogs.forEach((log) => {
          get().addChangeLog(
            'buoy_log',
            log.id,
            'create',
            null,
            {
              buoyId: log.buoyId,
              seagrassCoverage: log.seagrassCoverage,
              biomass: log.biomass,
              recordTime: log.recordTime,
              batch: batchName,
            },
            '系统',
            `导入新增 [${batchName}]`
          );
        });

        const batchSummary = [
          `新增 ${result.newCount}`,
          result.duplicateCount > 0 && `重复识别 ${result.duplicateCount}`,
          result.mergedCount > 0 && `合并补录 ${result.mergedCount}`,
          result.skippedWithRemark > 0 && `保留备注 ${result.skippedWithRemark}`,
          result.preservedConfirmedCount > 0 && `保留确认 ${result.preservedConfirmedCount}`,
          result.anomalyCount > 0 && `异常 ${result.anomalyCount}`,
        ]
          .filter(Boolean)
          .join(' | ');

        get().addChangeLog(
          'buoy_log',
          'batch-import',
          'import',
          null,
          {
            total: result.total,
            newCount: result.newCount,
            duplicateCount: result.duplicateCount,
            anomalyCount: result.anomalyCount,
            batch: batchName,
          },
          '系统',
          `批量导入 ${batchName}：${batchSummary}`
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

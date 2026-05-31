import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BattleRecord,
  VersionSnapshot,
  FilterConditions,
  Anomaly,
  BatchTask,
  BatchExecution,
  ExportSnapshot,
  AuditLog,
  OperationType,
  ConsistencyCheckResult
} from '@/types';
import { generateDataFingerprint, generateFilterFingerprint, generateIdempotencyKey } from '@/utils/fingerprint';
import { applyFilter } from '@/utils/importer';
import { detectAnomalies } from '@/utils/anomalyDetector';
import { idempotentExecutor } from '@/utils/idempotent';
import { exportData, downloadBlob } from '@/utils/exporter';
import { generateMockRecords, generateMockBatchTasks } from '@/mock/initialData';

interface AppState {
  records: BattleRecord[];
  currentVersion: VersionSnapshot | null;
  versionHistory: VersionSnapshot[];
  filterConditions: FilterConditions;
  filterFingerprint: string;
  anomalies: Anomaly[];
  batchTasks: BatchTask[];
  currentExecution: BatchExecution | null;
  exportHistory: ExportSnapshot[];
  auditLogs: AuditLog[];
  currentOperator: string;
  isFilterPanelOpen: boolean;
  filteredRecords: BattleRecord[];
  idempotentExecutor: typeof idempotentExecutor;
  
  createVersion: (operationType: OperationType, records: BattleRecord[], remark: string) => VersionSnapshot;
  importRecords: (records: BattleRecord[], remark: string) => VersionSnapshot;
  rollbackToVersion: (versionId: string, remark: string) => VersionSnapshot;
  applyFilter: (conditions: FilterConditions) => void;
  resetFilter: () => void;
  toggleFilterPanel: () => void;
  detectAnomalies: () => Anomaly[];
  resolveAnomaly: (anomalyId: string, resolvedBy: string) => void;
  ignoreAnomaly: (anomalyId: string) => void;
  runBatchTask: (taskId: string) => Promise<BatchExecution>;
  exportRecords: (format: 'csv' | 'xlsx' | 'pdf', includeConsistencyReport: boolean, remark: string) => Promise<ExportSnapshot>;
  refreshData: () => void;
  addAuditLog: (versionId: string, action: string, details: Record<string, any>) => void;
  initializeMockData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      records: [],
      currentVersion: null,
      versionHistory: [],
      filterConditions: {},
      filterFingerprint: '',
      anomalies: [],
      batchTasks: [],
      currentExecution: null,
      exportHistory: [],
      auditLogs: [],
      currentOperator: '当前用户',
      isFilterPanelOpen: true,
      filteredRecords: [],
      idempotentExecutor,

      createVersion: (operationType, records, remark) => {
        const state = get();
        const newVersion: VersionSnapshot = {
          id: crypto.randomUUID(),
          version: state.versionHistory.length + 1,
          parentVersionId: state.currentVersion?.id || null,
          operationType,
          operator: state.currentOperator,
          remark,
          dataFingerprint: generateDataFingerprint(records),
          snapshotData: JSON.parse(JSON.stringify(records)),
          filterFingerprint: state.filterFingerprint,
          filterConditions: JSON.parse(JSON.stringify(state.filterConditions)),
          createdAt: new Date().toISOString()
        };

        set(state => ({
          records,
          currentVersion: newVersion,
          versionHistory: [...state.versionHistory, newVersion]
        }));

        get().addAuditLog(newVersion.id, `版本创建: ${operationType}`, {
          recordCount: records.length,
          remark
        });

        return newVersion;
      },

      importRecords: (incomingRecords, remark) => {
        const state = get();
        const existingIds = new Set(state.records.map(r => r.id));
        const mergedRecords = [
          ...state.records.filter(r => !incomingRecords.find(inc => inc.id === r.id)),
          ...incomingRecords
        ];

        const version = get().createVersion('import', mergedRecords, remark);
        get().detectAnomalies();
        return version;
      },

      rollbackToVersion: (versionId, remark) => {
        const state = get();
        const targetVersion = state.versionHistory.find(v => v.id === versionId);
        
        if (!targetVersion) {
          throw new Error(`未找到版本: ${versionId}`);
        }

        const rollbackRecords = JSON.parse(JSON.stringify(targetVersion.snapshotData));
        const rollbackRemark = `回滚到版本 ${targetVersion.version}: ${remark || targetVersion.remark}`;
        
        const version = get().createVersion('rollback', rollbackRecords, rollbackRemark);
        get().detectAnomalies();
        return version;
      },

      applyFilter: (conditions) => {
        const state = get();
        const newFingerprint = generateFilterFingerprint(conditions);
        const filtered = applyFilter(state.records, conditions);
        
        set({
          filterConditions: conditions,
          filterFingerprint: newFingerprint,
          filteredRecords: filtered
        });
      },

      resetFilter: () => {
        get().applyFilter({});
      },

      toggleFilterPanel: () => {
        set(state => ({ isFilterPanelOpen: !state.isFilterPanelOpen }));
      },

      detectAnomalies: () => {
        const state = get();
        if (!state.currentVersion) return [];
        
        const anomalies = detectAnomalies(state.records, state.currentVersion.id);
        set({ anomalies });
        
        const updatedRecords = state.records.map(r => {
          const recordAnomalies = anomalies.filter(a => a.recordId === r.id);
          if (recordAnomalies.length > 0) {
            type Severity = 'low' | 'medium' | 'high' | 'critical';
            const maxSeverity = recordAnomalies.reduce<Severity>((max, a) => {
              const severityOrder: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
              return severityOrder[a.severity] > severityOrder[max] ? a.severity as Severity : max;
            }, 'low');
            const newStatus: 'anomaly' | 'warning' = maxSeverity === 'critical' || maxSeverity === 'high' ? 'anomaly' : 'warning';
            return {
              ...r,
              status: newStatus
            };
          }
          return r;
        });

        if (JSON.stringify(updatedRecords) !== JSON.stringify(state.records)) {
          set({ records: updatedRecords });
          get().applyFilter(state.filterConditions);
        }

        return anomalies;
      },

      resolveAnomaly: (anomalyId, resolvedBy) => {
        set(state => ({
          anomalies: state.anomalies.map(a =>
            a.id === anomalyId
              ? { ...a, status: 'resolved', resolvedAt: new Date().toISOString(), resolvedBy }
              : a
          )
        }));
      },

      ignoreAnomaly: (anomalyId) => {
        set(state => ({
          anomalies: state.anomalies.map(a =>
            a.id === anomalyId
              ? { ...a, status: 'ignored', resolvedAt: new Date().toISOString(), resolvedBy: state.currentOperator }
              : a
          )
        }));
      },

      runBatchTask: async (taskId) => {
        const state = get();
        const task = state.batchTasks.find(t => t.id === taskId);
        
        if (!task) {
          throw new Error(`未找到任务: ${taskId}`);
        }

        const operation = async (onProgress: (progress: number) => Promise<void> | void) => {
          const records = [...state.records];
          let successCount = 0;
          let failCount = 0;
          const result: Record<string, any> = { changes: [] };

          for (let i = 0; i < records.length; i++) {
            try {
              if (task.operationType === 'batch' && task.config.formula) {
                const oldSettlement = records[i].settlement;
                records[i].settlement = Math.floor(records[i].score * 0.5);
                if (oldSettlement !== records[i].settlement) {
                  result.changes.push({
                    recordId: records[i].id,
                    field: 'settlement',
                    oldValue: oldSettlement,
                    newValue: records[i].settlement
                  });
                }
              }
              successCount++;
              onProgress?.(Math.floor(((i + 1) / records.length) * 100));
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch {
              failCount++;
            }
          }

          return { successCount, failCount, result };
        };

        const execution = await idempotentExecutor.execute(
          task,
          operation,
          (progress) => set({ currentExecution: { ...get().currentExecution!, progress } }),
          (log) => set({
            currentExecution: {
              ...get().currentExecution!,
              logs: [...get().currentExecution!.logs, log]
            }
          })
        );

        if (execution.status === 'completed' && !idempotentExecutor.getExecution(task.idempotencyKey)) {
          get().createVersion('batch', get().records, `批量任务: ${task.name}`);
          get().detectAnomalies();
        }

        set({ currentExecution: execution });
        return execution;
      },

      exportRecords: async (format, includeConsistencyReport, remark) => {
        const state = get();
        
        if (!state.currentVersion) {
          throw new Error('没有可用的版本数据');
        }

        const screenData = state.filteredRecords.length > 0 ? state.filteredRecords : state.records;
        const recordsToExport = [...screenData];

        const { snapshot, blob, fileName } = await exportData(screenData, recordsToExport, {
          format,
          includeConsistencyReport,
          remark,
          operator: state.currentOperator,
          versionId: state.currentVersion.id,
          filterConditions: state.filterConditions,
          filterFingerprint: state.filterFingerprint
        });

        downloadBlob(blob, fileName);

        set(state => ({
          exportHistory: [snapshot, ...state.exportHistory]
        }));

        get().addAuditLog(state.currentVersion.id, '数据导出', {
          format,
          recordCount: recordsToExport.length,
          filterFingerprint: state.filterFingerprint,
          remark
        });

        return snapshot;
      },

      refreshData: () => {
        const state = get();
        get().applyFilter(state.filterConditions);
        get().detectAnomalies();
      },

      addAuditLog: (versionId, action, details) => {
        const log: AuditLog = {
          id: crypto.randomUUID(),
          versionId,
          action,
          operator: get().currentOperator,
          details,
          createdAt: new Date().toISOString()
        };
        set(state => ({
          auditLogs: [log, ...state.auditLogs]
        }));
      },

      initializeMockData: () => {
        const records = generateMockRecords();
        const version = get().createVersion('import', records, '初始化模拟数据');
        get().detectAnomalies();
        set({
          batchTasks: generateMockBatchTasks(),
          filteredRecords: records
        });
      }
    }),
    {
      name: 'city-power-grid-store',
      partialize: (state) => ({
        records: state.records,
        currentVersion: state.currentVersion,
        versionHistory: state.versionHistory,
        filterConditions: state.filterConditions,
        filterFingerprint: state.filterFingerprint,
        anomalies: state.anomalies,
        batchTasks: state.batchTasks,
        exportHistory: state.exportHistory,
        auditLogs: state.auditLogs,
        isFilterPanelOpen: state.isFilterPanelOpen,
        filteredRecords: state.filteredRecords
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.idempotentExecutor = idempotentExecutor;
        }
      }
    }
  )
);

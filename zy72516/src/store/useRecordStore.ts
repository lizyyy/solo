import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AnnotationRecord,
  RecordStatus,
  JudgmentLog,
  ContentSnapshot,
  LogAction,
  ModelOutput,
  AbnormalTypeLabelMap,
  StatusLabelMap,
  AbnormalType
} from '../types';
import { generateMockRecords } from '../utils/mockData';
import { applyBoundaryRules } from '../utils/boundaryRules';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function takeSnapshot(record: AnnotationRecord): ContentSnapshot {
  return {
    annotatorMessage: record.annotatorMessage,
    referenceUrl: record.referenceUrl,
    urlStatus: record.urlStatus,
    robotJudgment: record.robotJudgment,
    modelOutputSnippet: record.modelOutput?.outputSnippet,
    modelOutputName: record.modelOutput?.modelName,
    modelOutputConfidence: record.modelOutput?.confidence,
    status: record.currentStatus,
    abnormalType: record.abnormalType
  };
}

function computeDiff(from: ContentSnapshot, to: ContentSnapshot): string[] {
  const diffs: string[] = [];

  if (from.status !== to.status) {
    diffs.push("状态从" + StatusLabelMap[from.status] + "变为" + StatusLabelMap[to.status]);
  }

  if (from.abnormalType !== to.abnormalType) {
    diffs.push("异常类型从" + AbnormalTypeLabelMap[from.abnormalType] + "变为" + AbnormalTypeLabelMap[to.abnormalType]);
  }

  if (from.annotatorMessage !== to.annotatorMessage) {
    diffs.push("标注员留言变更");
  }

  if (from.referenceUrl !== to.referenceUrl) {
    diffs.push("参考链接变更");
  }

  if (from.urlStatus !== to.urlStatus) {
    diffs.push("链接状态从" + (from.urlStatus ? "正常" : "异常") + "变为" + (to.urlStatus ? "正常" : "异常"));
  }

  if (from.robotJudgment !== to.robotJudgment) {
    diffs.push("机器人判断结论变更");
  }

  if (from.modelOutputSnippet !== to.modelOutputSnippet) {
    const fromText = from.modelOutputSnippet ? '"' + from.modelOutputSnippet.slice(0, 20) + (from.modelOutputSnippet.length > 20 ? "..." : "") + '"' : "暂无";
    const toText = to.modelOutputSnippet ? '"' + to.modelOutputSnippet.slice(0, 20) + (to.modelOutputSnippet.length > 20 ? "..." : "") + '"' : "暂无";
    diffs.push("模型输出从" + fromText + "更新为" + toText);
  }

  if (from.modelOutputName !== to.modelOutputName) {
    const fromName = from.modelOutputName || "未设置";
    const toName = to.modelOutputName || "未设置";
    diffs.push("模型名称从" + fromName + "更新为" + toName);
  }

  if (from.modelOutputConfidence !== to.modelOutputConfidence) {
    const fromConf = from.modelOutputConfidence != undefined ? ((from.modelOutputConfidence * 100).toFixed(1) + "%") : "无";
    const toConf = to.modelOutputConfidence != undefined ? ((to.modelOutputConfidence * 100).toFixed(1) + "%") : "无";
    diffs.push("置信度从" + fromConf + "更新为" + toConf);
  }

  return diffs;
}

interface RecordState {
  records: AnnotationRecord[];
  currentOperator: string;
  initialized: boolean;

  initMockData: () => void;
  addRecords: (newRecords: AnnotationRecord[]) => void;
  updateRecordStatus: (
    recordId: string,
    newStatus: RecordStatus,
    remark?: string
  ) => void;
  batchUpdateStatus: (
    recordIds: string[],
    newStatus: RecordStatus,
    remark?: string
  ) => void;
  getRecordById: (id: string) => AnnotationRecord | undefined;
  getRecordsByStatus: (status: RecordStatus) => AnnotationRecord[];
  getConflictSamples: () => AnnotationRecord[];
  clearAll: () => void;
  setOperator: (name: string) => void;
  fillModelOutput: (
    recordId: string,
    modelData: Partial<ModelOutput> & { outputSnippet: string; modelName: string; confidence?: number }
  ) => void;
  updateRecordContent: (
    recordId: string,
    updates: Partial<{ annotatorMessage: string; referenceUrl: string; urlStatus: boolean; robotJudgment: string }>
  ) => void;
  rollbackToLog: (recordId: string, logIndex: number) => void;
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: [],
      currentOperator: '阿宁',
      initialized: false,

      initMockData: () => {
        if (get().initialized) return;
        const mockData = generateMockRecords(10);
        set({ records: mockData, initialized: true });
      },

      addRecords: (newRecords) => {
        const processed = newRecords.map(record => {
          const beforeSnapshot = takeSnapshot(record);
          const ruleResult = applyBoundaryRules(record, get().currentOperator);
          const updatedRecord = {
            ...record,
            ...ruleResult
          };

          if (ruleResult.currentStatus && ruleResult.currentStatus != record.currentStatus) {
            const afterSnapshot = takeSnapshot(updatedRecord);
            const diffSummary = computeDiff(beforeSnapshot, afterSnapshot);

            const log: JudgmentLog = {
              id: generateId(),
              recordId: record.id,
              operator: get().currentOperator,
              action: LogAction.AUTO_DETECT,
              remark: "边界规则自动检测",
              fromStatus: record.currentStatus,
              toStatus: ruleResult.currentStatus,
              fromSnapshot: beforeSnapshot,
              toSnapshot: afterSnapshot,
              diffSummary,
              operatedAt: new Date().toISOString()
            };

            updatedRecord.judgmentLogs = [...record.judgmentLogs, log];
          }

          return updatedRecord;
        });
        set(state => ({
          records: [...state.records, ...processed]
        }));
      },

      updateRecordStatus: (recordId, newStatus, remark = "") => {
        set(state => ({
          records: state.records.map(record => {
            if (record.id != recordId) return record;

            const fromSnapshot = takeSnapshot(record);
            const updatedRecord = {
              ...record,
              currentStatus: newStatus
            };
            const toSnapshot = takeSnapshot(updatedRecord);
            const diffSummary = computeDiff(fromSnapshot, toSnapshot);

            const log: JudgmentLog = {
              id: generateId(),
              recordId,
              operator: state.currentOperator,
              action: LogAction.STATUS_CHANGE,
              remark,
              fromStatus: record.currentStatus,
              toStatus: newStatus,
              fromSnapshot,
              toSnapshot,
              diffSummary,
              operatedAt: new Date().toISOString()
            };

            return {
              ...updatedRecord,
              judgmentLogs: [...record.judgmentLogs, log],
              updatedAt: new Date().toISOString(),
              lastOperator: state.currentOperator
            };
          })
        }));
      },

      batchUpdateStatus: (recordIds, newStatus, remark = "") => {
        set(state => ({
          records: state.records.map(record => {
            if (recordIds.indexOf(record.id) == -1) return record;

            const fromSnapshot = takeSnapshot(record);
            const updatedRecord = {
              ...record,
              currentStatus: newStatus
            };
            const toSnapshot = takeSnapshot(updatedRecord);
            const diffSummary = computeDiff(fromSnapshot, toSnapshot);

            const log: JudgmentLog = {
              id: generateId(),
              recordId: record.id,
              operator: state.currentOperator,
              action: LogAction.BATCH_STATUS_CHANGE,
              remark,
              fromStatus: record.currentStatus,
              toStatus: newStatus,
              fromSnapshot,
              toSnapshot,
              diffSummary,
              operatedAt: new Date().toISOString()
            };

            return {
              ...updatedRecord,
              judgmentLogs: [...record.judgmentLogs, log],
              updatedAt: new Date().toISOString(),
              lastOperator: state.currentOperator
            };
          })
        }));
      },

      fillModelOutput: (recordId, modelData) => {
        set(state => ({
          records: state.records.map(record => {
            if (record.id != recordId) return record;

            const fromSnapshot = takeSnapshot(record);

            const newModelOutput: ModelOutput = {
              id: generateId(),
              recordId,
              modelName: modelData.modelName,
              outputSnippet: modelData.outputSnippet,
              confidence: modelData.confidence != undefined ? modelData.confidence : 0,
              reasoningDetails: modelData.reasoningDetails ? modelData.reasoningDetails : {},
              filledBy: state.currentOperator,
              filledAt: new Date().toISOString(),
              isBackfill: true
            };

            const updatedRecord = {
              ...record,
              modelOutput: newModelOutput,
              modelOutputMissing: false
            };

            const toSnapshot = takeSnapshot(updatedRecord);
            const diffSummary = computeDiff(fromSnapshot, toSnapshot);

            const log: JudgmentLog = {
              id: generateId(),
              recordId,
              operator: state.currentOperator,
              action: LogAction.MODEL_OUTPUT_FILL,
              remark: "补录模型输出：" + modelData.modelName,
              fromStatus: record.currentStatus,
              toStatus: record.currentStatus,
              fromSnapshot,
              toSnapshot,
              diffSummary,
              operatedAt: new Date().toISOString()
            };

            return {
              ...updatedRecord,
              judgmentLogs: [...record.judgmentLogs, log],
              updatedAt: new Date().toISOString(),
              lastOperator: state.currentOperator
            };
          })
        }));
      },

      updateRecordContent: (recordId, updates) => {
        set(state => ({
          records: state.records.map(record => {
            if (record.id != recordId) return record;

            const fromSnapshot = takeSnapshot(record);

            const updatedRecord = {
              ...record,
              ...updates
            };

            const toSnapshot = takeSnapshot(updatedRecord);
            const diffSummary = computeDiff(fromSnapshot, toSnapshot);

            if (diffSummary.length == 0) return record;

            let action: LogAction;
            if (updates.annotatorMessage != undefined) {
              action = LogAction.ANNOTATOR_MESSAGE_UPDATE;
            } else if (updates.robotJudgment != undefined) {
              action = LogAction.ROBOT_JUDGMENT_UPDATE;
            } else if (updates.referenceUrl != undefined || updates.urlStatus != undefined) {
              action = LogAction.URL_UPDATE;
            } else {
              action = LogAction.MODEL_OUTPUT_UPDATE;
            }

            const log: JudgmentLog = {
              id: generateId(),
              recordId,
              operator: state.currentOperator,
              action,
              remark: diffSummary.join("; "),
              fromStatus: record.currentStatus,
              toStatus: record.currentStatus,
              fromSnapshot,
              toSnapshot,
              diffSummary,
              operatedAt: new Date().toISOString()
            };

            return {
              ...updatedRecord,
              judgmentLogs: [...record.judgmentLogs, log],
              updatedAt: new Date().toISOString(),
              lastOperator: state.currentOperator
            };
          })
        }));
      },

      rollbackToLog: (recordId, logIndex) => {
        set(state => ({
          records: state.records.map(record => {
            if (record.id != recordId) return record;

            const targetLog = record.judgmentLogs[logIndex];
            if (targetLog == undefined || targetLog.fromSnapshot == undefined) return record;

            const fromSnapshot = takeSnapshot(record);
            const targetSnapshot = targetLog.fromSnapshot;

            const updatedRecord: AnnotationRecord = {
              ...record,
              annotatorMessage: targetSnapshot.annotatorMessage,
              referenceUrl: targetSnapshot.referenceUrl,
              urlStatus: targetSnapshot.urlStatus,
              robotJudgment: targetSnapshot.robotJudgment,
              currentStatus: targetSnapshot.status,
              abnormalType: targetSnapshot.abnormalType,
              updatedAt: new Date().toISOString(),
              lastOperator: state.currentOperator
            };

            if (targetSnapshot.modelOutputSnippet && record.modelOutput) {
              updatedRecord.modelOutput = {
                ...record.modelOutput,
                outputSnippet: targetSnapshot.modelOutputSnippet,
                modelName: targetSnapshot.modelOutputName || record.modelOutput.modelName,
                confidence: targetSnapshot.modelOutputConfidence != undefined ? targetSnapshot.modelOutputConfidence : record.modelOutput.confidence
              };
            }

            const toSnapshot = takeSnapshot(updatedRecord);
            const diffSummary = computeDiff(fromSnapshot, toSnapshot);

            const log: JudgmentLog = {
              id: generateId(),
              recordId,
              operator: state.currentOperator,
              action: LogAction.ROLLBACK,
              remark: "回滚到第 " + (logIndex + 1) + " 条操作记录",
              fromStatus: record.currentStatus,
              toStatus: targetSnapshot.status,
              fromSnapshot,
              toSnapshot,
              diffSummary,
              operatedAt: new Date().toISOString()
            };

            return {
              ...updatedRecord,
              judgmentLogs: [...record.judgmentLogs, log]
            };
          })
        }));
      },

      getRecordById: (id) => {
        return get().records.find(r => r.id == id);
      },

      getRecordsByStatus: (status) => {
        return get().records.filter(r => r.currentStatus == status);
      },

      getConflictSamples: () => {
        return get().records.filter(r =>
          r.currentStatus == RecordStatus.PM_REVIEW ||
          r.currentStatus == RecordStatus.WRONG_CRITERIA ||
          r.currentStatus == RecordStatus.REWORK
        );
      },

      clearAll: () => {
        set({ records: [], initialized: false });
      },

      setOperator: (name) => {
        set({ currentOperator: name });
      }
    }),
    {
      name: "after-sales-robot-storage",
      partialize: (state) => ({
        records: state.records,
        currentOperator: state.currentOperator,
        initialized: state.initialized
      })
    }
  )
);

let syncTimer: ReturnType<typeof setTimeout> | null = null;

useRecordStore.subscribe((state) => {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const { syncToServer } = await import('../utils/apiClient');
      await syncToServer(state.records, state.currentOperator, state.initialized);
    } catch {}
  }, 1000);
});

import { reactive, computed } from 'vue';
import type { WorkflowRecord, Correction, ReviewResult, RecordStatus } from '../types';
import { mockRecords, getStatusLabel } from '../data/mockData';
import { generateHistoryLog, calculateSafetyDistance } from '../utils/calculations';
import { feetToMeters } from '../utils/validation';

interface WorkflowStoreState {
  records: WorkflowRecord[];
  currentRecordId: string | null;
}

const STORAGE_KEY = 'theater-sound-field-workflow';

const loadFromStorage = (): WorkflowRecord[] | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  return null;
};

const saveToStorage = (records: WorkflowRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
};

const initialRecords = loadFromStorage() || mockRecords;

const state = reactive<WorkflowStoreState>({
  records: initialRecords,
  currentRecordId: null,
});

export function useWorkflowStore() {
  const pendingManagerReview = computed(() => 
    state.records.filter(r => r.status === 'pending-manager').map(r => r.id)
  );

  const getRecordById = (id: string): WorkflowRecord | undefined => {
    return state.records.find(r => r.id === id);
  };

  const getPendingReviewRecords = (): WorkflowRecord[] => {
    return state.records.filter(r => r.status === 'pending-manager');
  };

  const setCurrentRecord = (id: string | null) => {
    state.currentRecordId = id;
  };

  const advanceStep = (recordId: string) => {
    const record = state.records.find(r => r.id === recordId);
    if (record && record.currentStep < 2) {
      record.currentStep++;
      saveToStorage(state.records);
    }
  };

  const goToStep = (recordId: string, step: number) => {
    const record = state.records.find(r => r.id === recordId);
    if (record && step >= 0 && step <= 2) {
      record.currentStep = step;
      saveToStorage(state.records);
    }
  };

  const completeCadImport = (recordId: string) => {
    const record = state.records.find(r => r.id === recordId);
    if (record) {
      const log = generateHistoryLog(
        recordId,
        'CAD图层导入',
        '图层验证通过',
        '航测内业小魏',
        `共 ${record.cadLayers.length} 个图层通过名称验证`
      );
      record.status = 'cad-imported' as RecordStatus;
      record.statusLabel = getStatusLabel('cad-imported');
      record.currentStep = 1;
      record.historyLogs.push(log);
      saveToStorage(state.records);
    }
  };

  const markForManagerReview = (recordId: string) => {
    const record = state.records.find(r => r.id === recordId);
    if (record) {
      const log = generateHistoryLog(
        recordId,
        '测距仪记录审核',
        '提交施工经理复核',
        '航测内业小魏',
        '照片中告警标签被移动端截图遮挡，标记异常后提交复核'
      );
      record.status = 'pending-manager' as RecordStatus;
      record.statusLabel = getStatusLabel('pending-manager');
      record.historyLogs.push(log);
      saveToStorage(state.records);
    }
  };

  const processManagerReview = (recordId: string, result: ReviewResult, comment: string) => {
    const record = state.records.find(r => r.id === recordId);
    if (record) {
      const action = result === 'approved' ? '复核通过' : '复核驳回';
      const log = generateHistoryLog(
        recordId,
        '施工经理复核',
        action,
        '施工经理',
        `复核意见：${comment || '无'}`
      );
      const newStatus: RecordStatus = 'under-review';
      record.status = newStatus;
      record.statusLabel = result === 'approved' ? '审核通过' : '需要重新处理';
      record.reviewResult = result;
      record.reviewComment = comment;
      record.currentStep = 1;
      record.historyLogs.push(log);
      saveToStorage(state.records);
    }
  };

  const applyCorrection = (recordId: string, rangefinderId: string, correctionData: any) => {
    const record = state.records.find(r => r.id === recordId);
    if (record) {
      const correction: Correction = {
        id: Math.random().toString(36).substring(2, 11),
        rangefinderId,
        ...correctionData,
        correctedAt: new Date().toISOString(),
        operator: '航测内业小魏',
      };
      
      const rangefinderRecord = record.rangefinderRecords.find(rr => rr.id === rangefinderId);
      if (rangefinderRecord) {
        rangefinderRecord.distance = correctionData.newDistance;
        rangefinderRecord.unit = 'm';
        rangefinderRecord.caliber = correctionData.newCaliber;
        rangefinderRecord.needsCorrection = false;
      }
      
      const log = generateHistoryLog(
        recordId,
        '测距仪记录审核',
        '人工修正数据',
        '航测内业小魏',
        `修正原因：${correctionData.reason}，数据：${correctionData.oldDistance} ${correctionData.oldCaliber} → ${correctionData.newDistance} m`
      );
      
      record.status = 'corrected' as RecordStatus;
      record.statusLabel = getStatusLabel('corrected');
      record.corrections.push(correction);
      record.historyLogs.push(log);
      saveToStorage(state.records);
    }
  };

  const rerunCalculation = (recordId: string) => {
    const record = state.records.find(r => r.id === recordId);
    if (record) {
      const log = generateHistoryLog(
        recordId,
        '测距仪记录审核',
        '重跑计算',
        '航测内业小魏',
        '使用修正后的数据重新计算安全距离'
      );
      record.currentStep = 2;
      record.historyLogs.push(log);
      saveToStorage(state.records);
    }
  };

  const generateSafetyReport = (recordId: string) => {
    const record = state.records.find(r => r.id === recordId);
    if (record) {
      const version = record.corrections.length > 0 ? `v${record.corrections.length + 1}` : 'v1';
      const report = calculateSafetyDistance(recordId, record.rangefinderRecords, version);
      
      const log = generateHistoryLog(
        recordId,
        '安全距离报告',
        '报告生成',
        '航测内业小魏',
        `安全距离报告 ${version} 生成完成，结果：${report.isSafe ? '安全' : '不安全'}`
      );
      
      record.status = 'report-generated' as RecordStatus;
      record.statusLabel = getStatusLabel('report-generated');
      record.safetyReport = report;
      record.historyLogs.push(log);
      saveToStorage(state.records);
    }
  };

  const resetRecord = (recordId: string) => {
    const originalRecord = mockRecords.find(mr => mr.id === recordId);
    if (originalRecord) {
      const index = state.records.findIndex(r => r.id === recordId);
      if (index !== -1) {
        state.records[index] = { 
          ...originalRecord, 
          historyLogs: [...originalRecord.historyLogs] 
        };
        saveToStorage(state.records);
      }
    }
  };

  const resetAllRecords = () => {
    state.records = [...mockRecords];
    state.currentRecordId = null;
    saveToStorage(mockRecords);
  };

  return {
    state,
    pendingManagerReview,
    getRecordById,
    getPendingReviewRecords,
    setCurrentRecord,
    advanceStep,
    goToStep,
    completeCadImport,
    markForManagerReview,
    processManagerReview,
    applyCorrection,
    rerunCalculation,
    generateSafetyReport,
    resetRecord,
    resetAllRecords,
  };
}

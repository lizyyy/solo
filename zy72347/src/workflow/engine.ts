import { DataRecord, ProcessingResult, WorkflowStep, ChangeRecord } from '../types';
import { getRecord, saveRecord } from '../store/data-store';
import { logAction } from '../store/audit-log';
import { generateId } from '../utils/id';
import { normalizeValue } from '../core/format-detector';
import { evaluateRules } from '../core/boundary-rules';

export interface AnnotationOptions {
  recordId: string;
  author: string;
  content: string;
  screenshotRef?: string;
}

export interface ReviewOptions {
  recordId: string;
  reviewer: string;
  decision: 'approve' | 'reject' | 'rollback';
  comment: string;
  targetFormat?: 'decimal' | 'percentage';
}

export interface UpdateOptions {
  recordId: string;
  operator: string;
  fieldValues: Record<string, string>;
  reason: string;
}

export function canAdvanceStep(record: DataRecord, targetStep: WorkflowStep): boolean {
  const stepOrder: WorkflowStep[] = ['import', 'annotation', 'update'];
  const currentIdx = stepOrder.indexOf(record.currentStep);
  const targetIdx = stepOrder.indexOf(targetStep);

  if (targetIdx <= currentIdx) {
    return false;
  }

  if (record.hasMixedFormat && record.status !== 'approved') {
    return targetStep !== 'update';
  }

  return true;
}

export function addAnnotation(options: AnnotationOptions): ProcessingResult<DataRecord> {
  const { recordId, author, content, screenshotRef } = options;

  const recordResult = getRecord(recordId);
  if (!recordResult.success || !recordResult.data) {
    return { success: false, errors: recordResult.errors, warnings: [] };
  }

  const record = recordResult.data;

  if (record.currentStep !== 'annotation' && record.currentStep !== 'import') {
    return {
      success: false,
      errors: [`当前步骤为 ${record.currentStep}，无法添加批注`],
      warnings: [],
    };
  }

  const annotation = {
    id: generateId('ann'),
    timestamp: Date.now(),
    author,
    content,
    screenshotRef,
  };

  record.annotations.push(annotation);
  record.currentStep = 'annotation';
  record.status = record.hasMixedFormat ? 'pending_review' : 'reviewed';

  const saveResult = saveRecord(record);
  if (!saveResult.success) {
    return saveResult;
  }

  logAction(author, 'ANNOTATION_ADDED', {
    recordId,
    annotationId: annotation.id,
    content,
    screenshotRef,
  }, recordId);

  return { success: true, data: record, errors: [], warnings: [] };
}

export function reviewRecord(options: ReviewOptions): ProcessingResult<DataRecord> {
  const { recordId, reviewer, decision, comment, targetFormat = 'decimal' } = options;

  const recordResult = getRecord(recordId);
  if (!recordResult.success || !recordResult.data) {
    return { success: false, errors: recordResult.errors, warnings: [] };
  }

  const record = recordResult.data;

  if (record.status !== 'pending_review' && record.status !== 'detected_mixed') {
    return {
      success: false,
      errors: [`当前状态为 ${record.status}，无需复核`],
      warnings: [],
    };
  }

  const change: ChangeRecord = {
    id: generateId('chg'),
    timestamp: Date.now(),
    operator: reviewer,
    field: '__review_decision__',
    oldValue: record.status,
    newValue: decision,
    reason: comment,
    rollbackAvailable: decision !== 'reject',
  };

  record.changeHistory.push(change);
  record.reviewDecision = decision;
  record.reviewTimestamp = Date.now();
  record.status = 'reviewed';

  if (decision === 'approve') {
    record.status = 'approved';
    record.currentStep = 'annotation';
    record.rawValues.forEach((raw, key) => {
      const normalized = normalizeValue(raw, targetFormat);
      record.normalizedValues.set(key, normalized);
    });
  } else if (decision === 'reject') {
    record.status = 'rejected';
  } else if (decision === 'rollback') {
    record.status = 'rolled_back';
  }

  const triggeredRules = evaluateRules(record);
  const warnings = triggeredRules
    .filter((r) => r.severity === 'warning' || r.severity === 'error')
    .map((r) => `[${r.id}] ${r.name}: ${r.description}`);

  const saveResult = saveRecord(record);
  if (!saveResult.success) {
    return saveResult;
  }

  logAction(reviewer, 'REVIEW_COMPLETED', {
    recordId,
    decision,
    comment,
    targetFormat,
  }, recordId);

  return { success: true, data: record, errors: [], warnings };
}

export function updateRecord(options: UpdateOptions): ProcessingResult<DataRecord> {
  const { recordId, operator, fieldValues, reason } = options;

  const recordResult = getRecord(recordId);
  if (!recordResult.success || !recordResult.data) {
    return { success: false, errors: recordResult.errors, warnings: [] };
  }

  const record = recordResult.data;

  if (record.hasMixedFormat && record.status !== 'approved') {
    return {
      success: false,
      errors: ['该记录存在混合格式，需先经活动负责人批准后方可更新'],
      warnings: [],
    };
  }

  if (record.currentStep !== 'annotation' && record.currentStep !== 'update') {
    return {
      success: false,
      errors: [`当前步骤为 ${record.currentStep}，无法更新`],
      warnings: [],
    };
  }

  record.currentStep = 'update';

  Object.entries(fieldValues).forEach(([field, newValue]) => {
    const oldRaw = record.rawValues.get(field);
    if (oldRaw) {
      const change: ChangeRecord = {
        id: generateId('chg'),
        timestamp: Date.now(),
        operator,
        field,
        oldValue: oldRaw.original,
        newValue,
        reason,
        rollbackAvailable: true,
      };
      record.changeHistory.push(change);
    }
  });

  record.status = 'completed';
  record.completedBy = operator;
  record.completedTimestamp = Date.now();

  const saveResult = saveRecord(record);
  if (!saveResult.success) {
    return saveResult;
  }

  logAction(operator, 'RECORD_UPDATED', {
    recordId,
    updatedFields: Object.keys(fieldValues),
    reason,
  }, recordId);

  return { success: true, data: record, errors: [], warnings: [] };
}

export function rollbackRecord(recordId: string, operator: string, reason: string): ProcessingResult<DataRecord> {
  const recordResult = getRecord(recordId);
  if (!recordResult.success || !recordResult.data) {
    return { success: false, errors: recordResult.errors, warnings: [] };
  }

  const record = recordResult.data;

  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  if (now - record.importTimestamp > windowMs) {
    return {
      success: false,
      errors: ['已超过24小时回滚窗口期'],
      warnings: [],
    };
  }

  const rollbackChange: ChangeRecord = {
    id: generateId('chg'),
    timestamp: Date.now(),
    operator,
    field: '__rollback__',
    oldValue: record.status,
    newValue: 'rolled_back',
    reason,
    rollbackAvailable: false,
  };

  record.changeHistory.push(rollbackChange);
  record.status = 'rolled_back';

  const saveResult = saveRecord(record);
  if (!saveResult.success) {
    return saveResult;
  }

  logAction(operator, 'RECORD_ROLLED_BACK', {
    recordId,
    reason,
  }, recordId);

  return { success: true, data: record, errors: [], warnings: [] };
}

export function getWorkflowStatus(record: DataRecord): string {
  const stepNames: Record<WorkflowStep, string> = {
    import: '第一步：旧公式截图导入',
    annotation: '第二步：运营规划阿岚补看老师批注',
    update: '第三步：计算明细更新',
  };

  return stepNames[record.currentStep];
}

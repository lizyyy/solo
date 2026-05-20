import dayjs from '../utils/dayjs';
import { CriticalValueRecord, CallbackRecord, DutyRecord, FailedRecord } from '../types';
import { all } from '../db';

const CALLBACK_TIMEOUT_MINUTES = 30;
const REPEAT_CRITICAL_HOURS = 24;
const NIGHT_SHIFT_START = 22;
const NIGHT_SHIFT_END = 6;

export interface RuleResult {
  passed: boolean;
  violations: string[];
  suggestion: string;
}

export const checkCallbackTimeout = async (
  record: CriticalValueRecord,
  callbacks: CallbackRecord[]
): Promise<RuleResult> => {
  const violations: string[] = [];
  const testTime = dayjs(record.testTime);

  const matchingCallbacks = callbacks.filter(
    (cb) => cb.patientId === record.patientId && 
            dayjs(cb.callbackTime).isAfter(testTime)
  );

  if (matchingCallbacks.length === 0) {
    const timeSinceTest = dayjs().diff(testTime, 'minute');
    if (timeSinceTest > CALLBACK_TIMEOUT_MINUTES) {
      violations.push(`未回告超时：检验后${timeSinceTest}分钟仍未回告`);
      return {
        passed: false,
        violations,
        suggestion: `立即电话回告临床科室，超时已超过${CALLBACK_TIMEOUT_MINUTES}分钟，需在系统中补登回告记录`
      };
    }
  }

  return { passed: true, violations: [], suggestion: '' };
};

export const checkRepeatCriticalValues = async (
  record: CriticalValueRecord,
  allRecords: CriticalValueRecord[]
): Promise<RuleResult> => {
  const violations: string[] = [];
  const testTime = dayjs(record.testTime);

  const recentCriticals = allRecords.filter(
    (r) => r.patientId === record.patientId &&
           r.id !== record.id &&
           dayjs(r.testTime).isAfter(testTime.subtract(REPEAT_CRITICAL_HOURS, 'hour')) &&
           r.testItem === record.testItem
  );

  if (recentCriticals.length > 0) {
    violations.push(`同患者多次危急值：${REPEAT_CRITICAL_HOURS}小时内第${recentCriticals.length + 1}次出现${record.testItem}危急值`);
    return {
      passed: false,
      violations,
      suggestion: `重点关注该患者病情变化，建议立即通知主管医生，考虑是否需要紧急干预，联系电话：请查询科室值班表`
    };
  }

  return { passed: true, violations: [], suggestion: '' };
};

export const checkNightShiftGap = async (
  record: CriticalValueRecord,
  dutyRecords: DutyRecord[]
): Promise<RuleResult> => {
  const violations: string[] = [];
  const testTime = dayjs(record.testTime);
  const hour = testTime.hour();

  const isNightShift = hour >= NIGHT_SHIFT_START || hour < NIGHT_SHIFT_END;

  if (isNightShift) {
    const testDate = testTime.format('YYYY-MM-DD');
    
    const nightDuty = dutyRecords.find(
      (d) => d.date === testDate && 
             d.shift === 'night' && 
             d.department === record.department &&
             d.isOnDuty
    );

    if (!nightDuty) {
      violations.push(`夜班交接缺口：${record.department}夜班无值班医生安排`);
      return {
        passed: false,
        violations,
        suggestion: `立即联系科室值班主任，查询夜班医生联系方式，确保危急值能及时传达给当班医护人员`
      };
    }

    const startTime = dayjs(`${testDate} ${nightDuty.startTime}`);
    const endTime = dayjs(`${testDate} ${nightDuty.endTime}`);
    const adjustedEndTime = endTime.isBefore(startTime) ? endTime.add(1, 'day') : endTime;

    if (!testTime.isBetween(startTime, adjustedEndTime)) {
      violations.push(`夜班交接缺口：检验时间处于值班交接空窗期`);
      return {
        passed: false,
        violations,
        suggestion: `属于交接班空窗期，需同时通知交班和接班医生，确保信息传递不中断，建议双签确认`
      };
    }
  }

  return { passed: true, violations: [], suggestion: '' };
};

export const checkRequiredFields = (record: CriticalValueRecord): RuleResult => {
  const violations: string[] = [];
  const requiredFields = [
    { key: 'patientId', label: '患者ID' },
    { key: 'patientName', label: '患者姓名' },
    { key: 'testItem', label: '检验项目' },
    { key: 'testValue', label: '检验值' },
    { key: 'testTime', label: '检验时间' },
    { key: 'department', label: '科室' }
  ];

  for (const field of requiredFields) {
    const value = (record as any)[field.key];
    if (!value || String(value).trim() === '') {
      violations.push(`必填字段缺失：${field.label}`);
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      violations,
      suggestion: '补全缺失字段后重新导入，或联系信息科核对原始数据'
    };
  }

  return { passed: true, violations: [], suggestion: '' };
};

export const checkDuplicateInBatch = (
  record: CriticalValueRecord,
  batchRecords: CriticalValueRecord[]
): RuleResult => {
  const duplicates = batchRecords.filter(
    (r) => r.id !== record.id &&
           r.patientId === record.patientId &&
           r.testItem === record.testItem &&
           r.testTime === record.testTime
  );

  if (duplicates.length > 0) {
    return {
      passed: false,
      violations: [`批次内重复：同患者同项目同时段重复记录`],
      suggestion: '建议去重保留一条，核实是否为同一检验结果的多次上报'
    };
  }

  return { passed: true, violations: [], suggestion: '' };
};

export const processRecordWithRules = async (
  record: CriticalValueRecord,
  allRecords: CriticalValueRecord[],
  callbacks: CallbackRecord[],
  duties: DutyRecord[]
): Promise<{ record: CriticalValueRecord | FailedRecord; status: 'normal' | 'pending' | 'failed' }> => {
  const allViolations: string[] = [];
  const allSuggestions: string[] = [];

  const fieldCheck = checkRequiredFields(record);
  if (!fieldCheck.passed) {
    allViolations.push(...fieldCheck.violations);
    allSuggestions.push(fieldCheck.suggestion);
  }

  const duplicateCheck = checkDuplicateInBatch(record, allRecords);
  if (!duplicateCheck.passed) {
    allViolations.push(...duplicateCheck.violations);
    allSuggestions.push(duplicateCheck.suggestion);
  }

  const callbackCheck = await checkCallbackTimeout(record, callbacks);
  if (!callbackCheck.passed) {
    allViolations.push(...callbackCheck.violations);
    allSuggestions.push(callbackCheck.suggestion);
  }

  const repeatCheck = await checkRepeatCriticalValues(record, allRecords);
  if (!repeatCheck.passed) {
    allViolations.push(...repeatCheck.violations);
    allSuggestions.push(repeatCheck.suggestion);
  }

  const nightCheck = await checkNightShiftGap(record, duties);
  if (!nightCheck.passed) {
    allViolations.push(...nightCheck.violations);
    allSuggestions.push(nightCheck.suggestion);
  }

  if (allViolations.length > 0) {
    const hasTimeout = allViolations.some(v => v.includes('未回告超时'));
    
    if (hasTimeout || allViolations.some(v => v.includes('缺失') || v.includes('重复'))) {
      const failedRecord: FailedRecord = {
        ...record,
        status: 'failed',
        originalData: { ...record },
        failureReason: allViolations.join('；'),
        suggestion: allSuggestions.filter(s => s).join('；'),
        ruleViolations: allViolations
      };
      return { record: failedRecord, status: 'failed' };
    } else {
      const pendingRecord: CriticalValueRecord = {
        ...record,
        status: 'pending',
        failureReason: allViolations.join('；'),
        suggestion: allSuggestions.filter(s => s).join('；')
      };
      return { record: pendingRecord, status: 'pending' };
    }
  }

  return {
    record: { ...record, status: 'normal' },
    status: 'normal'
  };
};

export const getHistoryForReview = async (criticalValueId: string) => {
  const criticalValue = await all(
    'SELECT * FROM critical_values WHERE id = ?',
    [criticalValueId]
  );

  if (!criticalValue || criticalValue.length === 0) {
    return null;
  }

  const callbacks = await all(
    'SELECT * FROM callback_records WHERE patient_id = ? ORDER BY callback_time DESC',
    [criticalValue[0].patient_id]
  );

  const confirmRecords = await all(
    'SELECT * FROM confirm_records WHERE critical_value_id = ? ORDER BY confirm_time DESC',
    [criticalValueId]
  );

  const samePatientRecords = await all(
    'SELECT * FROM critical_values WHERE patient_id = ? AND id != ? ORDER BY test_time DESC LIMIT 10',
    [criticalValue[0].patient_id, criticalValueId]
  );

  return {
    criticalValue: criticalValue[0],
    callbacks,
    confirmRecords,
    samePatientHistory: samePatientRecords
  };
};

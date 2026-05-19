import dayjs from 'dayjs';
import { groupBy } from 'lodash';
import {
  CriticalValueRecord,
  CallbackRecord,
  DutySchedule,
  Discrepancy,
  ReconciliationResult,
  ReconciliationStatus,
  ReconciliationSummary,
  DiscrepancyType,
} from '../types';
import { DataStore } from '../store/DataStore';

export const CALLBACK_TIMEOUT_MINUTES = 30;
export const MULTIPLE_CRITICAL_VALUE_WINDOW_MINUTES = 60;

export class ReconciliationEngine {
  private dataStore: DataStore;

  constructor() {
    this.dataStore = DataStore.getInstance();
  }

  async runReconciliation(): Promise<ReconciliationResult[]> {
    this.dataStore.clearReconciliations();

    const criticalValues = this.dataStore.getAllCriticalValues();
    const callbacks = this.dataStore.getAllCallbacks();
    const dutySchedules = this.dataStore.getAllDutySchedules();

    const results: ReconciliationResult[] = [];

    for (const cv of criticalValues) {
      const matchingCallbacks = this.findMatchingCallbacks(cv, callbacks);
      const discrepancies = this.detectDiscrepancies(cv, matchingCallbacks, dutySchedules);

      const status: ReconciliationStatus = discrepancies.length === 0 ? 'matched' : 'mismatched';

      const result = this.dataStore.addReconciliation({
        criticalValueId: cv.id,
        callbackId: matchingCallbacks.length > 0 ? matchingCallbacks[0].id : undefined,
        status,
        discrepancies,
        matchedAt: new Date(),
      });

      results.push(result);
    }

    return results;
  }

  private findMatchingCallbacks(cv: CriticalValueRecord, allCallbacks: CallbackRecord[]): CallbackRecord[] {
    const potentialMatches = allCallbacks.filter(cb => {
      if (cb.criticalValueId === cv.id) return true;
      if (cb.patientId === cv.patientId) {
        const timeDiff = Math.abs(dayjs(cb.calledAt).diff(dayjs(cv.reportedAt), 'minute'));
        if (timeDiff < 120) return true;
      }
      return false;
    });

    return potentialMatches.sort((a, b) => {
      const diffA = Math.abs(dayjs(a.calledAt).diff(dayjs(cv.reportedAt), 'minute'));
      const diffB = Math.abs(dayjs(b.calledAt).diff(dayjs(cv.reportedAt), 'minute'));
      return diffA - diffB;
    });
  }

  private detectDiscrepancies(
    cv: CriticalValueRecord,
    callbacks: CallbackRecord[],
    dutySchedules: DutySchedule[]
  ): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    const noCallbackDisc = this.checkNoCallback(cv, callbacks);
    if (noCallbackDisc) discrepancies.push(noCallbackDisc);

    const timeoutDisc = this.checkCallbackTimeout(cv, callbacks);
    if (timeoutDisc) discrepancies.push(timeoutDisc);

    const multipleCvDisc = this.checkMultipleCriticalValues(cv);
    if (multipleCvDisc) discrepancies.push(multipleCvDisc);

    const shiftGapDisc = this.checkShiftGap(cv, callbacks, dutySchedules);
    if (shiftGapDisc) discrepancies.push(shiftGapDisc);

    const confirmationDisc = this.checkDoctorConfirmation(cv, callbacks);
    if (confirmationDisc) discrepancies.push(confirmationDisc);

    const dataConsistencyDisc = this.checkDataConsistency(cv, callbacks);
    if (dataConsistencyDisc) discrepancies.push(dataConsistencyDisc);

    return discrepancies;
  }

  private checkNoCallback(cv: CriticalValueRecord, callbacks: CallbackRecord[]): Discrepancy | null {
    if (callbacks.length === 0) {
      return {
        type: 'no_callback',
        description: `危急值报告后未找到电话回告记录`,
        severity: 'high',
        details: {
          patientId: cv.patientId,
          patientName: cv.patientName,
          testItem: cv.testItem,
          reportedAt: cv.reportedAt.toISOString(),
          priority: cv.priority,
        },
      };
    }
    return null;
  }

  private checkCallbackTimeout(cv: CriticalValueRecord, callbacks: CallbackRecord[]): Discrepancy | null {
    if (callbacks.length === 0) return null;

    const firstCallback = callbacks[0];
    const timeDiff = dayjs(firstCallback.calledAt).diff(dayjs(cv.reportedAt), 'minute');

    const timeoutThreshold = cv.priority === 'emergency' ? 10 : CALLBACK_TIMEOUT_MINUTES;

    if (timeDiff > timeoutThreshold) {
      return {
        type: 'callback_timeout',
        description: `电话回告超时，危急值报告后 ${timeDiff} 分钟才回电（超时阈值：${timeoutThreshold} 分钟）`,
        severity: cv.priority === 'emergency' ? 'high' : 'medium',
        details: {
          patientId: cv.patientId,
          patientName: cv.patientName,
          testItem: cv.testItem,
          reportedAt: cv.reportedAt.toISOString(),
          calledAt: firstCallback.calledAt.toISOString(),
          delayMinutes: timeDiff,
          thresholdMinutes: timeoutThreshold,
          priority: cv.priority,
        },
      };
    }
    return null;
  }

  private checkMultipleCriticalValues(cv: CriticalValueRecord): Discrepancy | null {
    const allCvs = this.dataStore.getAllCriticalValues();
    const patientCvs = allCvs.filter(
      x => x.patientId === cv.patientId && x.id !== cv.id
    );

    const windowStart = dayjs(cv.reportedAt).subtract(MULTIPLE_CRITICAL_VALUE_WINDOW_MINUTES, 'minute');
    const windowEnd = dayjs(cv.reportedAt).add(MULTIPLE_CRITICAL_VALUE_WINDOW_MINUTES, 'minute');

    const nearbyCvs = patientCvs.filter(x => {
      const reportedAt = dayjs(x.reportedAt);
      return reportedAt.isAfter(windowStart) && reportedAt.isBefore(windowEnd);
    });

    if (nearbyCvs.length > 0) {
      return {
        type: 'multiple_critical_values',
        description: `同一患者在 ${MULTIPLE_CRITICAL_VALUE_WINDOW_MINUTES} 分钟内出现 ${nearbyCvs.length + 1} 条危急值记录，需确认是否重复报告或病情恶化`,
        severity: 'medium',
        details: {
          patientId: cv.patientId,
          patientName: cv.patientName,
          currentCriticalValue: {
            testItem: cv.testItem,
            testResult: cv.testResult,
            reportedAt: cv.reportedAt.toISOString(),
          },
          nearbyCriticalValues: nearbyCvs.map(x => ({
            testItem: x.testItem,
            testResult: x.testResult,
            reportedAt: x.reportedAt.toISOString(),
          })),
          windowMinutes: MULTIPLE_CRITICAL_VALUE_WINDOW_MINUTES,
        },
      };
    }
    return null;
  }

  private checkShiftGap(
    cv: CriticalValueRecord,
    callbacks: CallbackRecord[],
    dutySchedules: DutySchedule[]
  ): Discrepancy | null {
    const reportedAt = dayjs(cv.reportedAt);
    const reportedHour = reportedAt.hour();

    const isNightShift = reportedHour >= 20 || reportedHour < 8;

    if (!isNightShift) return null;

    const shiftDate = reportedHour < 8 ? reportedAt.subtract(1, 'day') : reportedAt;
    const nightSchedules = dutySchedules.filter(
      ds => ds.shift === 'night' && dayjs(ds.date).isSame(shiftDate, 'day') && ds.department === cv.department
    );

    if (nightSchedules.length === 0) {
      return {
        type: 'shift_gap',
        description: `夜班危急值报告，但未找到对应科室（${cv.department}）的值班表记录，可能存在交接缺口`,
        severity: 'high',
        details: {
          patientId: cv.patientId,
          patientName: cv.patientName,
          department: cv.department,
          reportedAt: cv.reportedAt.toISOString(),
          shift: 'night',
        },
      };
    }

    if (callbacks.length > 0) {
      const cb = callbacks[0];
      const onDutyDoctors = nightSchedules.map(ds => ds.doctorName);
      
      if (cb.doctorName && !onDutyDoctors.some(name => name.includes(cb.doctorName) || cb.doctorName.includes(name))) {
        return {
          type: 'shift_gap',
          description: `夜班回告医生（${cb.doctorName}）不在值班表名单中，可能存在交接问题`,
          severity: 'medium',
          details: {
            patientId: cv.patientId,
            patientName: cv.patientName,
            department: cv.department,
            reportedAt: cv.reportedAt.toISOString(),
            calledDoctor: cb.doctorName,
            onDutyDoctors,
          },
        };
      }
    }

    return null;
  }

  private checkDoctorConfirmation(cv: CriticalValueRecord, callbacks: CallbackRecord[]): Discrepancy | null {
    if (callbacks.length === 0) return null;

    const cb = callbacks[0];
    if (!cb.confirmedAt) {
      return {
        type: 'doctor_confirmation_missing',
        description: `电话已拨通，但医生确认记录缺失`,
        severity: 'medium',
        details: {
          patientId: cv.patientId,
          patientName: cv.patientName,
          testItem: cv.testItem,
          calledAt: cb.calledAt.toISOString(),
          calledTo: cb.calledTo,
          doctorName: cb.doctorName,
        },
      };
    }

    return null;
  }

  private checkDataConsistency(cv: CriticalValueRecord, callbacks: CallbackRecord[]): Discrepancy | null {
    if (callbacks.length === 0) return null;

    const cb = callbacks[0];
    const inconsistencies: string[] = [];

    if (cb.patientName && cv.patientName !== cb.patientName) {
      inconsistencies.push(`患者姓名不一致: 危急值="${cv.patientName}", 回告="${cb.patientName}"`);
    }

    if (inconsistencies.length > 0) {
      return {
        type: 'data_inconsistency',
        description: `数据一致性问题: ${inconsistencies.join('; ')}`,
        severity: 'low',
        details: {
          patientId: cv.patientId,
          inconsistencies,
        },
      };
    }

    return null;
  }

  getSummary(): ReconciliationSummary {
    const results = this.dataStore.getAllReconciliations();
    const criticalValues = this.dataStore.getAllCriticalValues();
    const callbacks = this.dataStore.getAllCallbacks();

    const discrepancyBreakdown: Record<DiscrepancyType, number> = {
      no_callback: 0,
      callback_timeout: 0,
      multiple_critical_values: 0,
      shift_gap: 0,
      doctor_confirmation_missing: 0,
      data_inconsistency: 0,
    };

    for (const result of results) {
      for (const disc of result.discrepancies) {
        discrepancyBreakdown[disc.type]++;
      }
    }

    const cvByDept = groupBy(criticalValues, 'department');
    const resultByCvId = new Map(results.map(r => [r.criticalValueId, r]));

    const departmentStats: Record<string, { total: number; matched: number; mismatched: number }> = {};

    for (const [dept, cvs] of Object.entries(cvByDept)) {
      let matched = 0;
      let mismatched = 0;

      for (const cv of cvs) {
        const result = resultByCvId.get(cv.id);
        if (result) {
          if (result.status === 'matched' || result.status === 'reviewed') matched++;
          else mismatched++;
        }
      }

      departmentStats[dept] = { total: cvs.length, matched, mismatched };
    }

    return {
      totalCriticalValues: criticalValues.length,
      totalCallbacks: callbacks.length,
      matchedCount: results.filter(r => r.status === 'matched').length,
      mismatchedCount: results.filter(r => r.status === 'mismatched').length,
      pendingCount: results.filter(r => r.status === 'pending').length,
      reviewedCount: results.filter(r => r.status === 'reviewed').length,
      discrepancyBreakdown,
      departmentStats,
    };
  }

  getReconciliationDetails(reconciliationId: string) {
    const reconciliation = this.dataStore.getReconciliation(reconciliationId);
    if (!reconciliation) return null;

    const criticalValue = this.dataStore.getCriticalValue(reconciliation.criticalValueId);
    const callback = reconciliation.callbackId ? this.dataStore.getCallback(reconciliation.callbackId) : undefined;
    const reviewActions = this.dataStore.getReviewActions(reconciliationId);

    return {
      reconciliation,
      criticalValue,
      callback,
      reviewActions,
    };
  }
}

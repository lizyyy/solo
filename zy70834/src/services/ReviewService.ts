import {
  ReconciliationResult,
  ReviewAction,
  HealthCheckRecord,
  MedicationAuthorization,
  Student,
  Discrepancy,
} from '../types';
import { ReconciliationEngine } from './ReconciliationEngine';
import { formatDate } from '../utils/date';

export class ReviewService {
  private engine: ReconciliationEngine;

  constructor(engine: ReconciliationEngine) {
    this.engine = engine;
  }

  performReview(action: ReviewAction): ReconciliationResult | null {
    const result = this.engine.getResultById(action.resultId);
    if (!result) {
      return null;
    }

    switch (action.action) {
      case 'APPROVE':
        return this.approveResult(result, action);
      case 'REJECT':
        return this.rejectResult(result, action);
      case 'REQUEST_INFO':
        return this.requestMoreInfo(result, action);
      case 'MODIFY':
        return this.modifyAndRecalculate(result, action);
      default:
        return null;
    }
  }

  private approveResult(
    result: ReconciliationResult,
    action: ReviewAction
  ): ReconciliationResult {
    const updated: ReconciliationResult = {
      ...result,
      status: 'APPROVED',
      reviewedBy: action.reviewer,
      reviewedAt: formatDate(new Date()),
      reviewNotes: action.notes || '人工审核通过',
    };
    this.engine.updateResult(updated);
    return updated;
  }

  private rejectResult(
    result: ReconciliationResult,
    action: ReviewAction
  ): ReconciliationResult {
    const updated: ReconciliationResult = {
      ...result,
      status: 'REJECTED',
      reviewedBy: action.reviewer,
      reviewedAt: formatDate(new Date()),
      reviewNotes: action.notes || '人工审核驳回',
    };
    this.engine.updateResult(updated);
    return updated;
  }

  private requestMoreInfo(
    result: ReconciliationResult,
    action: ReviewAction
  ): ReconciliationResult {
    const updated: ReconciliationResult = {
      ...result,
      status: 'NEEDS_MORE_INFO',
      reviewedBy: action.reviewer,
      reviewedAt: formatDate(new Date()),
      reviewNotes: action.notes || '需补充材料',
    };
    this.engine.updateResult(updated);
    return updated;
  }

  private modifyAndRecalculate(
    result: ReconciliationResult,
    action: ReviewAction
  ): ReconciliationResult {
    if (!action.modifications || action.modifications.length === 0) {
      return result;
    }

    let updatedResult = { ...result };

    for (const modification of action.modifications) {
      updatedResult = this.applyModification(updatedResult, modification);
    }

    const oldNotes = updatedResult.reviewNotes || '';
    const modificationLog = action.modifications
      .map(
        (m) =>
          `[修改] ${m.field}: ${m.oldValue} → ${m.newValue} (原因: ${m.reason})`
      )
      .join('\n');

    updatedResult.reviewedBy = action.reviewer;
    updatedResult.reviewedAt = formatDate(new Date());
    updatedResult.reviewNotes = oldNotes
      ? `${oldNotes}\n${modificationLog}`
      : modificationLog;

    updatedResult = this.recalculateDiscrepancies(updatedResult);

    this.engine.updateResult(updatedResult);
    return updatedResult;
  }

  private applyModification(
    result: ReconciliationResult,
    modification: { field: string; oldValue: any; newValue: any; reason: string }
  ): ReconciliationResult {
    const fieldPath = modification.field.split('.');
    const updatedResult = { ...result };

    if (fieldPath[0] === 'healthCheck' && result.healthCheck) {
      const healthCheck = { ...result.healthCheck };
      (healthCheck as any)[fieldPath[1]] = modification.newValue;
      updatedResult.healthCheck = healthCheck;
    } else if (fieldPath[0] === 'medication' && result.medication) {
      const medication = { ...result.medication };
      (medication as any)[fieldPath[1]] = modification.newValue;
      updatedResult.medication = medication;
    } else if (fieldPath[0] === 'student') {
      const student = { ...result.student };
      (student as any)[fieldPath[1]] = modification.newValue;
      updatedResult.student = student;
    } else {
      (updatedResult as any)[fieldPath[0]] = modification.newValue;
    }

    return updatedResult;
  }

  private recalculateDiscrepancies(
    result: ReconciliationResult
  ): ReconciliationResult {
    const allResults = this.engine.getResults();
    const otherResults = allResults.filter((r) => r.id !== result.id);

    const tempEngine = new ReconciliationEngine();
    tempEngine.loadData(
      [result.student],
      result.healthCheck ? [result.healthCheck] : [],
      result.medication ? [result.medication] : []
    );

    const recalculated = tempEngine.performReconciliation()[0];

    if (recalculated) {
      return {
        ...result,
        discrepancies: recalculated.discrepancies,
        status: recalculated.status,
      };
    }

    return result;
  }

  batchApprove(resultIds: string[], reviewer: string): ReconciliationResult[] {
    const results: ReconciliationResult[] = [];
    for (const id of resultIds) {
      const result = this.performReview({
        resultId: id,
        action: 'APPROVE',
        reviewer,
      });
      if (result) {
        results.push(result);
      }
    }
    return results;
  }

  getModificationHistory(result: ReconciliationResult): string | null {
    return result.reviewNotes || null;
  }

  getAuditTrail(result: ReconciliationResult): {
    status: string;
    reviewedBy?: string;
    reviewedAt?: string;
    notes?: string;
  } {
    return {
      status: result.status,
      reviewedBy: result.reviewedBy,
      reviewedAt: result.reviewedAt,
      notes: result.reviewNotes,
    };
  }
}
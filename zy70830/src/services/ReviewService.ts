import { v4 as uuidv4 } from 'uuid';
import {
  Discrepancy,
  ReviewResult,
  ReviewAction,
  ReviewDecision,
  DataSource,
  BedStatus,
  PatientStatus,
  CleaningStatus
} from '../types';
import { dataStore } from '../models/DataStore';

export class ReviewService {
  async reviewDiscrepancy(
    discrepancyId: string,
    result: ReviewResult,
    action: ReviewAction,
    notes: string,
    reviewedBy: string,
    supportingEvidence?: string[]
  ): Promise<{ success: boolean; decision: ReviewDecision; updatedDiscrepancy?: Discrepancy }> {
    const discrepancy = dataStore.getDiscrepancy(discrepancyId);
    if (!discrepancy) {
      throw new Error(`Discrepancy ${discrepancyId} not found`);
    }

    const decision: ReviewDecision = {
      id: uuidv4(),
      discrepancyId,
      result,
      action,
      decisionNotes: notes,
      supportingEvidence,
      requiresFollowUp: result === ReviewResult.NEEDS_MORE_INFO,
      madeBy: reviewedBy,
      madeAt: new Date()
    };

    dataStore.addReviewDecision(decision);

    const updatedDiscrepancy = await this.applyResolutionAction(discrepancy, action, result, reviewedBy);

    dataStore.addAuditLog({
      action: 'discrepancy_reviewed',
      entityType: 'discrepancy',
      entityId: discrepancyId,
      previousValue: { status: discrepancy.reviewStatus, isResolved: discrepancy.isResolved },
      newValue: { status: result, isResolved: result === ReviewResult.APPROVED || result === ReviewResult.MANUALLY_RESOLVED },
      performedBy: reviewedBy,
      notes: `Review: ${result}, Action: ${action}, Notes: ${notes}`,
      source: DataSource.MANUAL_REVIEW
    });

    return {
      success: true,
      decision,
      updatedDiscrepancy
    };
  }

  private async applyResolutionAction(
    discrepancy: Discrepancy,
    action: ReviewAction,
    result: ReviewResult,
    reviewedBy: string
  ): Promise<Discrepancy> {
    const isResolved = result === ReviewResult.APPROVED || result === ReviewResult.MANUALLY_RESOLVED;

    const updates: Partial<Discrepancy> = {
      reviewStatus: result,
      reviewedBy,
      reviewedAt: new Date(),
      isResolved
    };

    if (isResolved) {
      updates.resolvedAt = new Date();
      updates.resolvedBy = reviewedBy;
      updates.resolutionNotes = `Resolved via ${action}`;
    }

    if (discrepancy.bedId) {
      await this.applyBedAction(discrepancy.bedId, action, reviewedBy);
    }

    if (discrepancy.patientId) {
      await this.applyPatientAction(discrepancy.patientId, action, reviewedBy);
    }

    if (discrepancy.workOrderId) {
      await this.applyWorkOrderAction(discrepancy.workOrderId, action, reviewedBy);
    }

    return dataStore.updateDiscrepancy(discrepancy.id, updates)!;
  }

  private async applyBedAction(bedId: string, action: ReviewAction, performedBy: string): Promise<void> {
    const bed = dataStore.getBed(bedId);
    if (!bed) return;

    switch (action) {
      case ReviewAction.RELEASE:
        dataStore.updateBed(bedId, { isLocked: false, status: BedStatus.VACANT });
        dataStore.addAuditLog({
          action: 'bed_released',
          entityType: 'bed',
          entityId: bedId,
          previousValue: { isLocked: bed.isLocked, status: bed.status },
          newValue: { isLocked: false, status: BedStatus.VACANT },
          performedBy,
          source: DataSource.MANUAL_REVIEW
        });
        break;

      case ReviewAction.LOCK:
        dataStore.updateBed(bedId, { isLocked: true, status: BedStatus.LOCKED });
        dataStore.addAuditLog({
          action: 'bed_locked',
          entityType: 'bed',
          entityId: bedId,
          previousValue: { isLocked: bed.isLocked, status: bed.status },
          newValue: { isLocked: true, status: BedStatus.LOCKED },
          performedBy,
          source: DataSource.MANUAL_REVIEW
        });
        break;

      case ReviewAction.UPDATE_STATUS:
        dataStore.updateBed(bedId, { status: BedStatus.VACANT });
        dataStore.addAuditLog({
          action: 'bed_status_updated',
          entityType: 'bed',
          entityId: bedId,
          previousValue: { status: bed.status },
          newValue: { status: BedStatus.VACANT },
          performedBy,
          source: DataSource.MANUAL_REVIEW
        });
        break;

      case ReviewAction.MARK_CLEANED:
        dataStore.updateBed(bedId, { status: BedStatus.VACANT, lastCleanedAt: new Date() });
        dataStore.addAuditLog({
          action: 'bed_marked_cleaned',
          entityType: 'bed',
          entityId: bedId,
          previousValue: { status: bed.status, lastCleanedAt: bed.lastCleanedAt },
          newValue: { status: BedStatus.VACANT, lastCleanedAt: new Date() },
          performedBy,
          source: DataSource.MANUAL_REVIEW
        });
        break;

      case ReviewAction.REMOVE_PATIENT:
        dataStore.updateBed(bedId, { currentPatientId: undefined, status: BedStatus.VACANT });
        dataStore.addAuditLog({
          action: 'patient_removed_from_bed',
          entityType: 'bed',
          entityId: bedId,
          previousValue: { currentPatientId: bed.currentPatientId, status: bed.status },
          newValue: { currentPatientId: undefined, status: BedStatus.VACANT },
          performedBy,
          source: DataSource.MANUAL_REVIEW
        });
        break;
    }
  }

  private async applyPatientAction(patientId: string, action: ReviewAction, performedBy: string): Promise<void> {
    const patient = dataStore.getPatient(patientId);
    if (!patient) return;

    switch (action) {
      case ReviewAction.REMOVE_PATIENT:
        dataStore.updatePatient(patientId, { currentBedId: undefined, status: PatientStatus.DISCHARGED });
        dataStore.addAuditLog({
          action: 'patient_discharged',
          entityType: 'patient',
          entityId: patientId,
          previousValue: { currentBedId: patient.currentBedId, status: patient.status },
          newValue: { currentBedId: undefined, status: PatientStatus.DISCHARGED },
          performedBy,
          source: DataSource.MANUAL_REVIEW
        });
        break;

      case ReviewAction.UPDATE_STATUS:
        dataStore.updatePatient(patientId, { status: PatientStatus.TRANSFERRED });
        dataStore.addAuditLog({
          action: 'patient_status_updated',
          entityType: 'patient',
          entityId: patientId,
          previousValue: { status: patient.status },
          newValue: { status: PatientStatus.TRANSFERRED },
          performedBy,
          source: DataSource.MANUAL_REVIEW
        });
        break;
    }
  }

  private async applyWorkOrderAction(workOrderId: string, action: ReviewAction, performedBy: string): Promise<void> {
    const workOrder = dataStore.getWorkOrder(workOrderId);
    if (!workOrder) return;

    switch (action) {
      case ReviewAction.MARK_CLEANED:
        dataStore.updateWorkOrder(workOrderId, { 
          status: CleaningStatus.COMPLETED, 
          completedAt: new Date() 
        });
        dataStore.addAuditLog({
          action: 'workorder_completed',
          entityType: 'workorder',
          entityId: workOrderId,
          previousValue: { status: workOrder.status, completedAt: workOrder.completedAt },
          newValue: { status: CleaningStatus.COMPLETED, completedAt: new Date() },
          performedBy,
          source: DataSource.MANUAL_REVIEW
        });
        break;
    }
  }

  getDiscrepancyReviewHistory(discrepancyId: string): {
    discrepancy: Discrepancy | undefined;
    decisions: ReviewDecision[];
    auditLogs: any[];
  } {
    const discrepancy = dataStore.getDiscrepancy(discrepancyId);
    const decisions = dataStore.getReviewDecisionsByDiscrepancy(discrepancyId);
    const auditLogs = dataStore.getAuditLogsByEntity('discrepancy', discrepancyId);

    return {
      discrepancy,
      decisions,
      auditLogs
    };
  }

  getPendingReviews(): Discrepancy[] {
    return dataStore.getAllDiscrepancies().filter(d => !d.isResolved);
  }

  getReviewedDiscrepancies(): Discrepancy[] {
    return dataStore.getAllDiscrepancies().filter(d => d.isResolved);
  }

  async batchReview(
    discrepancyIds: string[],
    result: ReviewResult,
    action: ReviewAction,
    notes: string,
    reviewedBy: string
  ): Promise<{ success: boolean; results: Array<{ discrepancyId: string; success: boolean; error?: string }> }> {
    const results: Array<{ discrepancyId: string; success: boolean; error?: string }> = [];

    for (const discrepancyId of discrepancyIds) {
      try {
        await this.reviewDiscrepancy(discrepancyId, result, action, notes, reviewedBy);
        results.push({ discrepancyId, success: true });
      } catch (error) {
        results.push({ 
          discrepancyId, 
          success: false, 
          error: (error as Error).message 
        });
      }
    }

    return {
      success: results.every(r => r.success),
      results
    };
  }

  getPatientAuditTrail(patientId: string): {
    patientInfo: any;
    history: any[];
    auditLogs: any[];
    relatedDiscrepancies: any[];
  } {
    const patient = dataStore.getPatient(patientId);
    if (!patient) {
      return { patientInfo: null, history: [], auditLogs: [], relatedDiscrepancies: [] };
    }

    const auditLogs = dataStore.getAuditLogsByEntity('patient', patientId);
    const relatedDiscrepancies = dataStore.getAllDiscrepancies().filter(d => d.patientId === patientId);

    return {
      patientInfo: {
        id: patient.id,
        name: patient.name,
        medicalRecordNumber: patient.medicalRecordNumber,
        currentStatus: patient.status,
        currentBedId: patient.currentBedId,
        admissionDate: patient.admissionDate,
        outcome: patient.outcome
      },
      history: patient.history,
      auditLogs,
      relatedDiscrepancies
    };
  }

  generateDiscrepancyExplanation(discrepancyId: string): {
    summary: string;
    detailedExplanation: string;
    rootCause: string;
    recommendedActions: string[];
    supportingEvidence: any[];
  } {
    const discrepancy = dataStore.getDiscrepancy(discrepancyId);
    if (!discrepancy) {
      throw new Error(`Discrepancy ${discrepancyId} not found`);
    }

    const { decisions, auditLogs } = this.getDiscrepancyReviewHistory(discrepancyId);

    const rootCauseMap: Record<string, string> = {
      status_mismatch: '床位状态与患者状态不同步，可能由于患者转科/出院记录缺失或床位更新延迟',
      duplicate_occupancy: '多名患者同时分配到同一床位，可能由于床位分配系统并发问题或人工操作错误',
      transfer_lock_bed: '转科锁床状态与患者实际状态不一致，可能由于转科流程未完成或锁床未及时释放',
      cleaning_timeout: '清洁工作未在规定时间内完成，可能由于清洁人员不足或工单未及时更新',
      missing_patient: '床位标记为占用但无对应患者记录，可能由于患者入科记录缺失',
      extra_patient: '患者有床位分配但床位状态为空床，可能由于患者出科记录缺失',
      bed_not_cleaned: '清洁状态与实际不符，可能由于清洁完成未及时登记或工单丢失',
      data_inconsistency: '数据引用不一致，可能由于ID生成或数据同步问题'
    };

    const recommendationsMap: Record<string, string[]> = {
      status_mismatch: [
        '核对患者流转记录，确认入科/出科时间',
        '更新床位状态与患者实际状态保持一致',
        '建立状态同步检查机制'
      ],
      duplicate_occupancy: [
        '确认每位患者的实际床位分配',
        '纠正错误的床位分配记录',
        '优化床位分配系统防并发机制'
      ],
      transfer_lock_bed: [
        '核实转科流程是否完成',
        '根据实际情况释放或保持床位锁定',
        '完善转科后床位自动解锁机制'
      ],
      cleaning_timeout: [
        '联系清洁班组确认进度',
        '根据实际情况更新工单号状态',
        '分析超时原因优化清洁流程'
      ],
      bed_not_cleaned: [
        '核实床位实际清洁状态',
        '补登缺失的清洁工单',
        '建立清洁完成的即时反馈机制'
      ]
    };

    return {
      summary: discrepancy.description,
      detailedExplanation: discrepancy.detailedExplanation,
      rootCause: rootCauseMap[discrepancy.type] || '待进一步分析',
      recommendedActions: recommendationsMap[discrepancy.type] || ['请根据实际情况采取相应措施'],
      supportingEvidence: [
        { type: 'discrepancy_data', data: discrepancy.sourceData },
        { type: 'review_decisions', data: decisions },
        { type: 'audit_logs', data: auditLogs.slice(0, 10) }
      ]
    };
  }
}

export const reviewService = new ReviewService();

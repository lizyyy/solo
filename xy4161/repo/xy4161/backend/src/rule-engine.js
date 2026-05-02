import { CASE_STATES, PROCESS_STEP_NAMES, REWORK_REASONS } from './state-machine.js';

export class RuleEngine {
  constructor(db) {
    this.db = db;
  }

  validatePrescriptionScanLink(caseId) {
    const violations = [];
    
    const prescription = this.db.prepare(`
      SELECT * FROM prescriptions WHERE case_id = ?
    `).get(caseId);

    if (!prescription) {
      violations.push({
        type: 'MISSING_PRESCRIPTION',
        severity: 'ERROR',
        message: '病例缺少处方信息',
        caseId
      });
      return violations;
    }

    const prescriptionTeeth = this.parseToothNumbers(prescription.tooth_numbers);
    const scans = this.db.prepare(`
      SELECT * FROM scan_files WHERE case_id = ? AND is_valid = 1
    `).all(caseId);

    if (scans.length === 0) {
      violations.push({
        type: 'MISSING_SCAN_FILES',
        severity: 'ERROR',
        message: '病例缺少有效的口扫文件',
        caseId,
        prescriptionTeeth
      });
      return violations;
    }

    const teethRecords = this.db.prepare(`
      SELECT * FROM teeth WHERE case_id = ?
    `).all(caseId);

    const teethInDb = new Set(teethRecords.map(t => t.tooth_number));
    const teethInPrescription = new Set(prescriptionTeeth);

    const missingTeeth = [...teethInPrescription].filter(t => !teethInDb.has(t));
    const extraTeeth = [...teethInDb].filter(t => !teethInPrescription.has(t));

    if (missingTeeth.length > 0) {
      violations.push({
        type: 'TEETH_MISMATCH',
        severity: 'WARNING',
        message: `处方中的牙位未在系统中注册: ${missingTeeth.join(', ')}`,
        caseId,
        missingTeeth
      });
    }

    if (extraTeeth.length > 0) {
      violations.push({
        type: 'TEETH_MISMATCH',
        severity: 'WARNING',
        message: `系统中存在处方未记录的牙位: ${extraTeeth.join(', ')}`,
        caseId,
        extraTeeth
      });
    }

    return violations;
  }

  checkVersionConflicts(caseId) {
    const violations = [];
    
    const teeth = this.db.prepare(`
      SELECT * FROM teeth WHERE case_id = ?
    `).all(caseId);

    for (const tooth of teeth) {
      const versions = this.db.prepare(`
        SELECT * FROM version_history 
        WHERE case_id = ? AND tooth_id = ?
        ORDER BY created_at DESC
      `).all(caseId, tooth.id);

      const activeProcessSteps = this.db.prepare(`
        SELECT * FROM process_steps 
        WHERE tooth_id = ? AND status = 'IN_PROGRESS'
      `).all(tooth.id);

      for (const step of activeProcessSteps) {
        if (step.version < tooth.version) {
          violations.push({
            type: 'VERSION_CONFLICT',
            severity: 'ERROR',
            message: `牙位 ${tooth.tooth_number} 存在版本冲突: 工序使用版本 v${step.version}，但当前最新版本是 v${tooth.version}`,
            caseId,
            toothId: tooth.id,
            toothNumber: tooth.tooth_number,
            stepVersion: step.version,
            currentVersion: tooth.version,
            stepName: step.step_name
          });
        }
      }
    }

    return violations;
  }

  checkDuplicateRework(toothId) {
    const violations = [];
    
    const tooth = this.db.prepare('SELECT * FROM teeth WHERE id = ?').get(toothId);
    if (!tooth) return violations;

    const reworkRequests = this.db.prepare(`
      SELECT * FROM rework_requests 
      WHERE tooth_id = ? 
      ORDER BY request_date DESC
    `).all(toothId);

    const pendingRework = reworkRequests.find(r => r.status === 'PENDING');
    const inProgressRework = reworkRequests.find(r => r.status === 'APPROVED');

    if (pendingRework) {
      violations.push({
        type: 'PENDING_REWORK_EXISTS',
        severity: 'WARNING',
        message: `牙位 ${tooth.tooth_number} 已有待复核的返工申请`,
        caseId: tooth.case_id,
        toothId,
        toothNumber: tooth.tooth_number,
        existingReworkId: pendingRework.id
      });
    }

    if (inProgressRework) {
      violations.push({
        type: 'REWORK_IN_PROGRESS',
        severity: 'ERROR',
        message: `牙位 ${tooth.tooth_number} 返工正在进行中，不可进行新的排产`,
        caseId: tooth.case_id,
        toothId,
        toothNumber: tooth.tooth_number,
        activeReworkId: inProgressRework.id
      });
    }

    if (tooth.rework_count >= 3) {
      violations.push({
        type: 'EXCESSIVE_REWORK',
        severity: 'CRITICAL',
        message: `牙位 ${tooth.tooth_number} 返工次数已达 ${tooth.rework_count} 次，需重点关注`,
        caseId: tooth.case_id,
        toothId,
        toothNumber: tooth.tooth_number,
        reworkCount: tooth.rework_count
      });
    }

    return violations;
  }

  checkTryInFeedbackFollowUp(caseId) {
    const violations = [];
    
    const feedbacks = this.db.prepare(`
      SELECT * FROM try_in_feedbacks 
      WHERE case_id = ? AND is_followed_up = 0
      ORDER BY feedback_date ASC
    `).all(caseId);

    const now = new Date();
    for (const feedback of feedbacks) {
      const feedbackDate = new Date(feedback.feedback_date);
      const daysSinceFeedback = Math.floor((now - feedbackDate) / (1000 * 60 * 60 * 24));

      if (daysSinceFeedback >= 3) {
        const tooth = feedback.tooth_id 
          ? this.db.prepare('SELECT tooth_number FROM teeth WHERE id = ?').get(feedback.tooth_id)
          : null;

        violations.push({
          type: 'TRY_IN_FEEDBACK_FOLLOWUP_OVERDUE',
          severity: 'ERROR',
          message: `试戴反馈已超过 ${daysSinceFeedback} 天未跟进${tooth ? ` (牙位: ${tooth.tooth_number})` : ''}`,
          caseId,
          feedbackId: feedback.id,
          toothNumber: tooth?.tooth_number,
          daysSinceFeedback,
          feedbackDate: feedback.feedback_date,
          needsRework: feedback.needs_rework
        });
      } else if (daysSinceFeedback >= 1) {
        const tooth = feedback.tooth_id 
          ? this.db.prepare('SELECT tooth_number FROM teeth WHERE id = ?').get(feedback.tooth_id)
          : null;

        violations.push({
          type: 'TRY_IN_FEEDBACK_FOLLOWUP_PENDING',
          severity: 'WARNING',
          message: `试戴反馈等待跟进已 ${daysSinceFeedback} 天${tooth ? ` (牙位: ${tooth.tooth_number})` : ''}`,
          caseId,
          feedbackId: feedback.id,
          toothNumber: tooth?.tooth_number,
          daysSinceFeedback
        });
      }
    }

    return violations;
  }

  validateProcessStepTransition(stepId, newStatus) {
    const violations = [];
    
    const step = this.db.prepare('SELECT * FROM process_steps WHERE id = ?').get(stepId);
    if (!step) {
      violations.push({
        type: 'STEP_NOT_FOUND',
        severity: 'ERROR',
        message: '工序不存在'
      });
      return violations;
    }

    const tooth = step.tooth_id 
      ? this.db.prepare('SELECT * FROM teeth WHERE id = ?').get(step.tooth_id)
      : null;

    if (tooth && step.version < tooth.version) {
      violations.push({
        type: 'VERSION_MISMATCH',
        severity: 'ERROR',
        message: `工序使用版本 v${step.version} 与牙位当前版本 v${tooth.version} 不匹配`,
        stepVersion: step.version,
        toothVersion: tooth.version
      });
    }

    if (tooth) {
      const activeRework = this.db.prepare(`
        SELECT * FROM rework_requests 
        WHERE tooth_id = ? AND status = 'APPROVED'
      `).get(tooth.id);

      if (activeRework && newStatus === 'IN_PROGRESS') {
        violations.push({
          type: 'REWORK_ACTIVE_SHOULD_NOT_START',
          severity: 'ERROR',
          message: '该牙位返工进行中，不应开始新的正常工序',
          reworkId: activeRework.id
        });
      }
    }

    const validStatusTransitions = {
      PENDING: ['IN_PROGRESS', 'SKIPPED'],
      IN_PROGRESS: ['COMPLETED', 'FAILED', 'ON_HOLD'],
      COMPLETED: [],
      FAILED: ['IN_PROGRESS', 'REWORK_REQUIRED'],
      ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
      SKIPPED: [],
      CANCELLED: [],
      REWORK_REQUIRED: []
    };

    const allowedTransitions = validStatusTransitions[step.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      violations.push({
        type: 'INVALID_STATUS_TRANSITION',
        severity: 'ERROR',
        message: `工序状态 ${step.status} 无法转换为 ${newStatus}`,
        currentStatus: step.status,
        requestedStatus: newStatus,
        allowedTransitions
      });
    }

    return violations;
  }

  runFullCaseValidation(caseId) {
    const allViolations = [
      ...this.validatePrescriptionScanLink(caseId),
      ...this.checkVersionConflicts(caseId),
      ...this.checkTryInFeedbackFollowUp(caseId)
    ];

    const teeth = this.db.prepare('SELECT id FROM teeth WHERE case_id = ?').all(caseId);
    for (const tooth of teeth) {
      allViolations.push(...this.checkDuplicateRework(tooth.id));
    }

    return {
      caseId,
      validationTime: new Date().toISOString(),
      totalViolations: allViolations.length,
      violations: allViolations,
      summary: this.summarizeViolations(allViolations)
    };
  }

  summarizeViolations(violations) {
    const summary = {
      CRITICAL: 0,
      ERROR: 0,
      WARNING: 0,
      INFO: 0,
      byType: {}
    };

    for (const v of violations) {
      summary[v.severity] = (summary[v.severity] || 0) + 1;
      summary.byType[v.type] = (summary.byType[v.type] || 0) + 1;
    }

    return summary;
  }

  parseToothNumbers(toothNumbersStr) {
    if (!toothNumbersStr) return [];
    
    const numbers = [];
    const parts = toothNumbersStr.split(/[,\s]+/);
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= 32) numbers.push(i);
        }
      } else {
        const num = Number(part);
        if (!isNaN(num) && num >= 1 && num <= 32) {
          numbers.push(num);
        }
      }
    }
    
    return [...new Set(numbers)].sort((a, b) => a - b);
  }
}

export const CASE_STATES = {
  PRESCRIPTION_RECEIVED: 'PRESCRIPTION_RECEIVED',
  SCAN_RECEIVED: 'SCAN_RECEIVED',
  DESIGNING: 'DESIGNING',
  DESIGN_APPROVED: 'DESIGN_APPROVED',
  MANUFACTURING: 'MANUFACTURING',
  QUALITY_CHECK: 'QUALITY_CHECK',
  TRY_IN: 'TRY_IN',
  TRY_IN_FEEDBACK_RECEIVED: 'TRY_IN_FEEDBACK_RECEIVED',
  FINAL_DELIVERY: 'FINAL_DELIVERY',
  COMPLETED: 'COMPLETED',
  REWORK_IN_PROGRESS: 'REWORK_IN_PROGRESS',
  CANCELLED: 'CANCELLED'
};

export const CASE_STATE_TRANSITIONS = {
  [CASE_STATES.PRESCRIPTION_RECEIVED]: {
    next: [CASE_STATES.SCAN_RECEIVED],
    canRework: false,
    description: '处方已接收'
  },
  [CASE_STATES.SCAN_RECEIVED]: {
    next: [CASE_STATES.DESIGNING],
    canRework: false,
    description: '口扫文件已接收'
  },
  [CASE_STATES.DESIGNING]: {
    next: [CASE_STATES.DESIGN_APPROVED, CASE_STATES.REWORK_IN_PROGRESS],
    canRework: true,
    description: '设计中'
  },
  [CASE_STATES.DESIGN_APPROVED]: {
    next: [CASE_STATES.MANUFACTURING, CASE_STATES.REWORK_IN_PROGRESS],
    canRework: true,
    description: '设计已批准'
  },
  [CASE_STATES.MANUFACTURING]: {
    next: [CASE_STATES.QUALITY_CHECK, CASE_STATES.REWORK_IN_PROGRESS],
    canRework: true,
    description: '加工中'
  },
  [CASE_STATES.QUALITY_CHECK]: {
    next: [CASE_STATES.TRY_IN, CASE_STATES.REWORK_IN_PROGRESS],
    canRework: true,
    description: '质检中'
  },
  [CASE_STATES.TRY_IN]: {
    next: [CASE_STATES.TRY_IN_FEEDBACK_RECEIVED, CASE_STATES.REWORK_IN_PROGRESS],
    canRework: true,
    description: '试戴中'
  },
  [CASE_STATES.TRY_IN_FEEDBACK_RECEIVED]: {
    next: [CASE_STATES.FINAL_DELIVERY, CASE_STATES.REWORK_IN_PROGRESS],
    canRework: true,
    description: '试戴反馈已接收'
  },
  [CASE_STATES.FINAL_DELIVERY]: {
    next: [CASE_STATES.COMPLETED, CASE_STATES.REWORK_IN_PROGRESS],
    canRework: true,
    description: '最终交付'
  },
  [CASE_STATES.COMPLETED]: {
    next: [CASE_STATES.REWORK_IN_PROGRESS],
    canRework: true,
    description: '已完成'
  },
  [CASE_STATES.REWORK_IN_PROGRESS]: {
    next: [CASE_STATES.DESIGNING, CASE_STATES.MANUFACTURING, CASE_STATES.QUALITY_CHECK],
    canRework: false,
    description: '返工进行中'
  },
  [CASE_STATES.CANCELLED]: {
    next: [],
    canRework: false,
    description: '已取消'
  }
};

export const TOOTH_STATES = {
  PENDING: 'PENDING',
  DESIGNING: 'DESIGNING',
  DESIGN_APPROVED: 'DESIGN_APPROVED',
  MANUFACTURING: 'MANUFACTURING',
  QUALITY_CHECK: 'QUALITY_CHECK',
  TRY_IN: 'TRY_IN',
  COMPLETED: 'COMPLETED',
  REWORK_NEEDED: 'REWORK_NEEDED',
  REWORK_IN_PROGRESS: 'REWORK_IN_PROGRESS'
};

export const PROCESS_STEP_NAMES = [
  'SCAN_VALIDATION',
  'DIGITAL_DESIGN',
  'DESIGN_APPROVAL',
  'MILLING',
  'SINTERING',
  'STACKING',
  'GLAZING',
  'QUALITY_INSPECTION',
  'TRY_IN_PREPARATION',
  'TRY_IN',
  'FINAL_INSPECTION',
  'DELIVERY'
];

export const REWORK_REASONS = {
  DESIGN_ISSUE: 'DESIGN_ISSUE',
  MANUFACTURING_DEFECT: 'MANUFACTURING_DEFECT',
  FIT_ISSUE: 'FIT_ISSUE',
  OCCLUSION_ISSUE: 'OCCLUSION_ISSUE',
  ESTHETICS_ISSUE: 'ESTHETICS_ISSUE',
  MATERIAL_DEFECT: 'MATERIAL_DEFECT',
  DOCTOR_REQUEST: 'DOCTOR_REQUEST',
  PATIENT_REQUEST: 'PATIENT_REQUEST',
  OTHER: 'OTHER'
};

export const REWORK_REASON_DESCRIPTIONS = {
  [REWORK_REASONS.DESIGN_ISSUE]: '设计问题',
  [REWORK_REASONS.MANUFACTURING_DEFECT]: '加工缺陷',
  [REWORK_REASONS.FIT_ISSUE]: '就位问题',
  [REWORK_REASONS.OCCLUSION_ISSUE]: '咬合问题',
  [REWORK_REASONS.ESTHETICS_ISSUE]: '美学问题',
  [REWORK_REASONS.MATERIAL_DEFECT]: '材料缺陷',
  [REWORK_REASONS.DOCTOR_REQUEST]: '医生要求',
  [REWORK_REASONS.PATIENT_REQUEST]: '患者要求',
  [REWORK_REASONS.OTHER]: '其他'
};

export class StateMachine {
  constructor(db) {
    this.db = db;
  }

  canTransition(fromState, toState) {
    const fromConfig = CASE_STATE_TRANSITIONS[fromState];
    if (!fromConfig) return false;
    return fromConfig.next.includes(toState);
  }

  getAvailableNextStates(currentState) {
    const config = CASE_STATE_TRANSITIONS[currentState];
    return config ? config.next : [];
  }

  getStateDescription(state) {
    const config = CASE_STATE_TRANSITIONS[state];
    return config ? config.description : state;
  }

  canStartRework(state) {
    const config = CASE_STATE_TRANSITIONS[state];
    return config ? config.canRework : false;
  }

  validateTransition(caseId, newState) {
    const currentCase = this.db.prepare('SELECT status FROM cases WHERE id = ?').get(caseId);
    if (!currentCase) {
      throw new Error(`Case not found: ${caseId}`);
    }

    if (!this.canTransition(currentCase.status, newState)) {
      throw new Error(
        `Invalid state transition: ${currentCase.status} -> ${newState}. ` +
        `Available transitions: ${this.getAvailableNextStates(currentCase.status).join(', ')}`
      );
    }

    return true;
  }

  transitionState(caseId, newState, changedBy, reason) {
    this.validateTransition(caseId, newState);
    
    const currentCase = this.db.prepare('SELECT id, status, case_number FROM cases WHERE id = ?').get(caseId);
    
    const updateStmt = this.db.prepare(`
      UPDATE cases 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    updateStmt.run(newState, caseId);

    this.createVersionHistory({
      caseId,
      entityType: 'CASE',
      entityId: caseId,
      action: 'STATE_TRANSITION',
      previousStatus: currentCase.status,
      newStatus: newState,
      changedBy,
      changeReason: reason
    });

    return {
      caseId,
      previousStatus: currentCase.status,
      newStatus,
      changedBy,
      reason,
      timestamp: new Date().toISOString()
    };
  }

  createVersionHistory(data) {
    const { v4: uuidv4 } = require('uuid');
    
    const stmt = this.db.prepare(`
      INSERT INTO version_history (
        id, case_id, tooth_id, entity_type, entity_id, version,
        action, previous_status, new_status, changed_by, change_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      uuidv4(),
      data.caseId,
      data.toothId || null,
      data.entityType,
      data.entityId,
      data.version || 1,
      data.action,
      data.previousStatus,
      data.newStatus,
      data.changedBy,
      data.changeReason
    );
  }

  getStateHistory(caseId) {
    return this.db.prepare(`
      SELECT 
        id,
        entity_type,
        entity_id,
        action,
        previous_status,
        new_status,
        changed_by,
        change_reason,
        created_at
      FROM version_history 
      WHERE case_id = ? 
      ORDER BY created_at ASC
    `).all(caseId);
  }
}

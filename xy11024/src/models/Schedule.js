const { v4: uuidv4 } = require('uuid');

const SCHEDULE_STATUS = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  NEEDS_REVIEW: '需人工审核'
};

const REHAB_PROGRAMS = {
  HOT_COMPRESS: '热敷护理',
  PELVIC_FLOOR: '盆底肌修复',
  ABDOMINAL_RECOVERY: '腹直肌分离修复',
  BREAST_CARE: '乳房护理',
  MASSAGE: '产后按摩',
  TCM_CONDITIONING: '中医调理',
  PSYCHOLOGICAL_COUNSELING: '心理疏导',
  NUTRITION_GUIDANCE: '营养指导'
};

const CONTRAINDICATIONS = {
  HIGH_FEVER: '高热',
  ACUTE_INFECTION: '急性感染',
  SKIN_DAMAGE: '皮肤破损',
  HEMORRHAGE: '出血倾向',
  THROMBOSIS: '血栓病史',
  SEVERE_HYPERTENSION: '重度高血压',
  HEART_DISEASE: '心脏病史'
};

class Schedule {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.patientId = data.patientId;
    this.patientName = data.patientName;
    this.patientAge = data.patientAge;
    this.postpartumDays = data.postpartumDays;
    this.deliveryMethod = data.deliveryMethod;
    this.programCode = data.programCode;
    this.programName = data.programName;
    this.scheduledDate = data.scheduledDate;
    this.scheduledTime = data.scheduledTime;
    this.therapistId = data.therapistId;
    this.therapistName = data.therapistName;
    this.roomNumber = data.roomNumber;
    this.status = data.status || SCHEDULE_STATUS.PENDING;
    this.contraindications = data.contraindications || [];
    this.contraindicationsResolved = data.contraindicationsResolved !== undefined ? data.contraindicationsResolved : true;
    this.reminderEnabled = data.reminderEnabled !== undefined ? data.reminderEnabled : true;
    this.reminderTime = data.reminderTime;
    this.manualNotes = data.manualNotes || '';
    this.needsManualReview = data.needsManualReview !== undefined ? data.needsManualReview : false;
    this.importBatchId = data.importBatchId;
    this.rowNumber = data.rowNumber;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  validate() {
    const errors = [];
    
    if (!this.patientId) errors.push({ field: 'patientId', message: '患者ID不能为空', severity: 'error' });
    if (!this.patientName) errors.push({ field: 'patientName', message: '患者姓名不能为空', severity: 'error' });
    if (!this.programCode) errors.push({ field: 'programCode', message: '项目编码不能为空', severity: 'error' });
    if (!this.programName) errors.push({ field: 'programName', message: '项目名称不能为空', severity: 'error' });
    if (!this.scheduledDate) errors.push({ field: 'scheduledDate', message: '排程日期不能为空', severity: 'error' });
    if (!this.scheduledTime) errors.push({ field: 'scheduledTime', message: '排程时间不能为空', severity: 'error' });
    
    if (this.programName === REHAB_PROGRAMS.HOT_COMPRESS && 
        this.contraindications.length > 0 && 
        !this.contraindicationsResolved) {
      this.needsManualReview = true;
      errors.push({
        field: 'contraindications',
        message: '存在未解除禁忌项却安排热敷项目',
        suggestion: '请人工确认禁忌项状态并添加备注后继续',
        severity: 'warning'
      });
    }
    
    if (this.reminderEnabled && !this.reminderTime) {
      this.needsManualReview = true;
      errors.push({
        field: 'reminderTime',
        message: '已开启提醒但未设置提醒时间',
        suggestion: '请设置提醒时间或关闭提醒后继续',
        severity: 'warning'
      });
    }
    
    if (!this.reminderEnabled && this.reminderTime) {
      this.needsManualReview = true;
      errors.push({
        field: 'reminderEnabled',
        message: '提醒已关闭但仍设置了提醒时间',
        suggestion: '请确认提醒设置一致性后继续',
        severity: 'warning'
      });
    }
    
    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      patientName: this.patientName,
      patientAge: this.patientAge,
      postpartumDays: this.postpartumDays,
      deliveryMethod: this.deliveryMethod,
      programCode: this.programCode,
      programName: this.programName,
      scheduledDate: this.scheduledDate,
      scheduledTime: this.scheduledTime,
      therapistId: this.therapistId,
      therapistName: this.therapistName,
      roomNumber: this.roomNumber,
      status: this.status,
      contraindications: this.contraindications,
      contraindicationsResolved: this.contraindicationsResolved,
      reminderEnabled: this.reminderEnabled,
      reminderTime: this.reminderTime,
      manualNotes: this.manualNotes,
      needsManualReview: this.needsManualReview,
      importBatchId: this.importBatchId,
      rowNumber: this.rowNumber,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = {
  Schedule,
  SCHEDULE_STATUS,
  REHAB_PROGRAMS,
  CONTRAINDICATIONS
};

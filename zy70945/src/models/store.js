/**
 * 内存数据存储 - 物业装修审批系统
 * 生产环境应替换为数据库
 */

const { v4: uuidv4 } = require('uuid');

class DataStore {
  constructor() {
    // 装修申请记录
    this.decorationApplications = new Map();
    // 巡检记录
    this.inspectionRecords = new Map();
    // 扣款规则
    this.deductionRules = new Map();
    // 审批记录
    this.approvalRecords = new Map();
    // 已处理批次指纹（用于去重）
    this.processedBatches = new Map();
    // 退款审批历史
    this.refundHistory = new Map();
    // 押金冻结记录
    this.depositFreezeRecords = new Map();
    // 违规记录
    this.violationRecords = new Map();

    this._initDefaultRules();
  }

  _initDefaultRules() {
    const defaultRules = [
      {
        id: 'RULE-001',
        name: '承重墙违规',
        type: 'violation_recheck',
        condition: { item: 'wall_type', value: 'bearing', check: 'equals' },
        penalty: { amount: 5000, freezeDeposit: true, description: '禁止拆除或改动承重墙' },
        priority: 1,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'RULE-002',
        name: '水电未报备',
        type: 'violation_recheck',
        condition: { item: 'has_water_electricity_report', value: false, check: 'equals' },
        penalty: { amount: 2000, freezeDeposit: true, description: '水电改造需提前报备' },
        priority: 2,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'RULE-003',
        name: '外立面改动',
        type: 'violation_recheck',
        condition: { item: 'has_facade_change', value: true, check: 'equals' },
        penalty: { amount: 3000, freezeDeposit: true, description: '禁止改动建筑外立面' },
        priority: 1,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'RULE-004',
        name: '消防设施遮挡',
        type: 'violation_recheck',
        condition: { item: 'fire_facility_blocked', value: true, check: 'equals' },
        penalty: { amount: 8000, freezeDeposit: true, description: '严禁遮挡消防设施' },
        priority: 1,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'RULE-005',
        name: '押金余额不足',
        type: 'deposit_check',
        condition: { item: 'deposit_balance', value: 0, check: 'lte' },
        penalty: { rejectRefund: true, description: '押金余额不足，无法退款' },
        priority: 1,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'RULE-006',
        name: '装修未验收',
        type: 'deposit_check',
        condition: { item: 'acceptance_status', value: 'pending', check: 'equals' },
        penalty: { rejectRefund: true, freezeDeposit: true, description: '装修尚未通过验收，押金冻结' },
        priority: 1,
        active: true,
        createdAt: new Date().toISOString()
      }
    ];

    defaultRules.forEach(rule => {
      this.deductionRules.set(rule.id, rule);
    });
  }

  // ========== 装修申请 ==========
  addDecorationApplication(app) {
    const id = app.id || `APP-${uuidv4().split('-')[0].toUpperCase()}`;
    const record = {
      ...app,
      id,
      createdAt: app.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.decorationApplications.set(id, record);
    return record;
  }

  getDecorationApplication(id) {
    return this.decorationApplications.get(id);
  }

  getApplicationsByOwner(ownerId) {
    return Array.from(this.decorationApplications.values())
      .filter(a => a.ownerId === ownerId);
  }

  // ========== 巡检记录 ==========
  addInspectionRecord(record) {
    const id = record.id || `INSP-${uuidv4().split('-')[0].toUpperCase()}`;
    const inspection = {
      ...record,
      id,
      createdAt: record.createdAt || new Date().toISOString()
    };
    this.inspectionRecords.set(id, inspection);
    return inspection;
  }

  getInspectionsByApplication(appId) {
    return Array.from(this.inspectionRecords.values())
      .filter(r => r.applicationId === appId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ========== 扣款规则 ==========
  addDeductionRule(rule) {
    const id = rule.id || `RULE-${uuidv4().split('-')[0].toUpperCase()}`;
    const record = {
      ...rule,
      id,
      createdAt: rule.createdAt || new Date().toISOString()
    };
    this.deductionRules.set(id, record);
    return record;
  }

  getActiveRules() {
    return Array.from(this.deductionRules.values())
      .filter(r => r.active)
      .sort((a, b) => a.priority - b.priority);
  }

  getRulesByType(type) {
    return this.getActiveRules().filter(r => r.type === type);
  }

  // ========== 审批记录 ==========
  addApprovalRecord(record) {
    const id = record.id || `APPR-${uuidv4().split('-')[0].toUpperCase()}`;
    const approval = {
      ...record,
      id,
      createdAt: record.createdAt || new Date().toISOString()
    };
    this.approvalRecords.set(id, approval);

    // 如果是退款审批，同时记录到退款历史
    if (record.type === 'refund') {
      this.refundHistory.set(id, approval);
    }

    return approval;
  }

  getApprovalRecordsByApplication(appId) {
    return Array.from(this.approvalRecords.values())
      .filter(r => r.applicationId === appId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ========== 退款历史追踪 ==========
  getRefundHistory() {
    return Array.from(this.refundHistory.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getRefundByApplication(appId) {
    return Array.from(this.refundHistory.values())
      .filter(r => r.applicationId === appId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getRefundTrace(refundId) {
    const refund = this.refundHistory.get(refundId);
    if (!refund) return null;

    const application = this.decorationApplications.get(refund.applicationId);
    const inspections = this.getInspectionsByApplication(refund.applicationId);
    const approvals = this.getApprovalRecordsByApplication(refund.applicationId);
    const violations = this.getViolationsByApplication(refund.applicationId);
    const freezeRecords = this.getDepositFreezeByApplication(refund.applicationId);

    return {
      refund,
      application,
      inspections,
      approvals,
      violations,
      freezeRecords,
      timeline: this._buildTimeline(application, inspections, approvals, violations, freezeRecords)
    };
  }

  _buildTimeline(application, inspections, approvals, violations, freezeRecords) {
    const events = [];

    if (application) {
      events.push({
        time: application.createdAt,
        type: 'application',
        title: '装修申请提交',
        description: `业主 ${application.ownerName || application.ownerId} 提交装修申请`,
        data: { applicationId: application.id }
      });
    }

    violations.forEach(v => {
      events.push({
        time: v.createdAt,
        type: 'violation',
        title: `违规记录: ${v.ruleName}`,
        description: v.description || v.penaltyDescription,
        data: { ruleId: v.ruleId, amount: v.penaltyAmount }
      });
    });

    freezeRecords.forEach(f => {
      events.push({
        time: f.createdAt,
        type: 'freeze',
        title: f.released ? '押金解冻' : '押金冻结',
        description: `${f.amount}元 - ${f.reason}`,
        data: { amount: f.amount, released: f.released }
      });
    });

    inspections.forEach(i => {
      events.push({
        time: i.createdAt,
        type: 'inspection',
        title: '巡检记录',
        description: `${i.inspector || '巡检员'} - ${i.result || '已完成'}`,
        data: { inspectionId: i.id }
      });
    });

    approvals.forEach(a => {
      events.push({
        time: a.createdAt,
        type: a.type,
        title: this._getApprovalTitle(a),
        description: a.reason || a.description,
        data: { status: a.status, approver: a.approver }
      });
    });

    return events.sort((a, b) => new Date(a.time) - new Date(b.time));
  }

  _getApprovalTitle(approval) {
    const titleMap = {
      'acceptance': '验收审批',
      'deduction': '扣款审批',
      'refund': '退款审批',
      'violation': '违规审批'
    };
    return titleMap[approval.type] || '审批记录';
  }

  // ========== 押金冻结记录 ==========
  addDepositFreeze(record) {
    const id = record.id || `FREEZE-${uuidv4().split('-')[0].toUpperCase()}`;
    const freeze = {
      ...record,
      id,
      createdAt: record.createdAt || new Date().toISOString(),
      released: record.released || false
    };
    this.depositFreezeRecords.set(id, freeze);
    return freeze;
  }

  getDepositFreezeByApplication(appId) {
    return Array.from(this.depositFreezeRecords.values())
      .filter(r => r.applicationId === appId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getActiveFreezeByApplication(appId) {
    return this.getDepositFreezeByApplication(appId)
      .filter(r => !r.released);
  }

  // ========== 违规记录 ==========
  addViolation(record) {
    const id = record.id || `VIOL-${uuidv4().split('-')[0].toUpperCase()}`;
    const violation = {
      ...record,
      id,
      createdAt: record.createdAt || new Date().toISOString(),
      resolved: record.resolved || false
    };
    this.violationRecords.set(id, violation);
    return violation;
  }

  getViolationsByApplication(appId) {
    return Array.from(this.violationRecords.values())
      .filter(r => r.applicationId === appId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getUnresolvedViolations(appId) {
    return this.getViolationsByApplication(appId)
      .filter(v => !v.resolved);
  }

  // ========== 批次去重 ==========
  isBatchProcessed(batchFingerprint) {
    return this.processedBatches.has(batchFingerprint);
  }

  markBatchProcessed(batchFingerprint, batchId, recordCount) {
    this.processedBatches.set(batchFingerprint, {
      batchId,
      recordCount,
      processedAt: new Date().toISOString()
    });
  }

  getBatchInfo(batchFingerprint) {
    return this.processedBatches.get(batchFingerprint);
  }
}

module.exports = new DataStore();

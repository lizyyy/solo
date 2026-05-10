const { v4: uuidv4 } = require('uuid');

class ApprovalRequest {
  constructor(params) {
    this.id = params.id || uuidv4();
    this.contractId = params.contractId;
    this.contractVersionId = params.contractVersionId;
    this.requestedBy = params.requestedBy;
    this.requestedAt = params.requestedAt || new Date().toISOString();
    this.approvalType = params.approvalType;
    this.changeSummary = params.changeSummary;
    this.status = params.status || 'PENDING';
    this.approvedBy = params.approvedBy || null;
    this.approvedAt = params.approvedAt || null;
    this.rejectionReason = params.rejectionReason || null;
    this.comments = params.comments || [];
  }

  getApprovalTypeDescription() {
    const descriptions = {
      'NEW_CONTRACT': '新合同审批',
      'AMOUNT_CHANGE': '金额变更审批',
      'TAX_RATE_CHANGE': '税率变更审批',
      'ITEM_CHANGE': '明细变更审批',
      'RECALCULATION': '历史重算审批'
    };
    return descriptions[this.approvalType] || this.approvalType;
  }

  getStatusDescription() {
    const descriptions = {
      'PENDING': '待审批',
      'APPROVED': '已通过',
      'REJECTED': '已驳回'
    };
    return descriptions[this.status] || this.status;
  }

  toJSON() {
    return {
      id: this.id,
      contractId: this.contractId,
      contractVersionId: this.contractVersionId,
      requestedBy: this.requestedBy,
      requestedAt: this.requestedAt,
      approvalType: this.approvalType,
      approvalTypeDescription: this.getApprovalTypeDescription(),
      changeSummary: this.changeSummary,
      status: this.status,
      statusDescription: this.getStatusDescription(),
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
      rejectionReason: this.rejectionReason,
      comments: this.comments
    };
  }
}

module.exports = ApprovalRequest;

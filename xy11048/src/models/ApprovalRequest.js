const { APPROVAL_STATES, APPROVAL_ROLES, REAGENT_CATEGORIES } = require('../config/constants');

class ApprovalRequest {
  constructor(data) {
    this.id = data.id;
    this.requestNo = data.requestNo;
    this.applicantId = data.applicantId;
    this.applicantName = data.applicantName;
    this.applicantDepartment = data.applicantDepartment;
    this.labId = data.labId;
    this.labName = data.labName;
    this.projectName = data.projectName;
    this.projectNumber = data.projectNumber;
    this.researchPurpose = data.researchPurpose;
    this.items = data.items || [];
    this.totalAmount = data.totalAmount || 0;
    this.estimatedUseDate = data.estimatedUseDate;
    this.storageLocation = data.storageLocation;
    this.emergencyContact = data.emergencyContact;
    this.emergencyPhone = data.emergencyPhone;
    this.safetyTrainingCertified = data.safetyTrainingCertified || false;
    this.wasteDisposalPlan = data.wasteDisposalPlan;
    this.currentState = data.currentState || APPROVAL_STATES.DRAFT;
    this.approvalHistory = data.approvalHistory || [];
    this.pendingReviewReasons = data.pendingReviewReasons || [];
    this.rejectionReason = data.rejectionReason || null;
    this.auditNotes = data.auditNotes || [];
    this.secondReviewRequired = data.secondReviewRequired || false;
    this.secondReviewCompleted = data.secondReviewCompleted || false;
    this.submittedAt = data.submittedAt || null;
    this.approvedAt = data.approvedAt || null;
    this.completedAt = data.completedAt || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.etag = data.etag || this.generateEtag();
  }

  generateEtag() {
    return `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  addApprovalRecord(approverId, approverName, role, action, comments = '') {
    this.approvalHistory.push({
      approverId,
      approverName,
      role,
      action,
      comments,
      timestamp: new Date(),
      fromState: this.currentState
    });
  }

  calculateTotalAmount() {
    this.totalAmount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    return this.totalAmount;
  }

  hasHazardousReagents() {
    return this.items.some(item => item.category === REAGENT_CATEGORIES.HAZARDOUS);
  }

  getHazardousItems() {
    return this.items.filter(item => item.category === REAGENT_CATEGORIES.HAZARDOUS);
  }

  static validate(data) {
    const errors = [];
    
    if (!data.applicantId) {
      errors.push('申请人ID不能为空');
    }
    if (!data.applicantName || data.applicantName.length < 2) {
      errors.push('申请人姓名不能为空');
    }
    if (!data.labId) {
      errors.push('实验室ID不能为空');
    }
    if (!data.labName) {
      errors.push('实验室名称不能为空');
    }
    if (!data.researchPurpose || data.researchPurpose.length < 10) {
      errors.push('科研用途说明至少需要10个字符');
    }
    if (!data.items || data.items.length === 0) {
      errors.push('请至少添加一项试剂');
    }
    
    if (data.items && data.items.length > 0) {
      data.items.forEach((item, index) => {
        if (!item.reagentId) {
          errors.push(`第${index + 1}项试剂ID不能为空`);
        }
        if (!item.reagentName) {
          errors.push(`第${index + 1}项试剂名称不能为空`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`第${index + 1}项试剂数量必须大于0`);
        }
        if (!item.unit) {
          errors.push(`第${index + 1}项试剂单位不能为空`);
        }
      });
    }
    
    if (data.hasHazardousReagents && data.hasHazardousReagents()) {
      if (!data.safetyTrainingCertified) {
        errors.push('领用危化试剂需要提供安全培训证明');
      }
      if (!data.wasteDisposalPlan || data.wasteDisposalPlan.length < 20) {
        errors.push('危化试剂废弃物处理方案至少需要20个字符');
      }
      if (!data.emergencyContact) {
        errors.push('请填写紧急联系人');
      }
      if (!data.emergencyPhone || !/^1[3-9]\d{9}$/.test(data.emergencyPhone)) {
        errors.push('紧急联系电话格式不正确');
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
}

module.exports = ApprovalRequest;

const ApprovalRequest = require('../models/ApprovalRequest');
const store = require('../stores/MemoryStore');
const ContractVersionService = require('./ContractVersionService');

class ApprovalService {
  static createApprovalRequest(params) {
    if (!params.contractId || !params.contractVersionId || !params.requestedBy) {
      throw new Error('审批请求缺少必要字段：contractId, contractVersionId, requestedBy 为必填项');
    }

    const contract = ContractVersionService.getContractById(params.contractId);
    if (!contract) {
      throw new Error(`合同 ${params.contractId} 不存在`);
    }

    const version = ContractVersionService.getVersionById(params.contractVersionId);
    if (!version) {
      throw new Error(`版本 ${params.contractVersionId} 不存在`);
    }

    const existingRequests = store.getApprovalRequestsByVersionId(params.contractVersionId);
    const pendingRequests = existingRequests.filter(r => r.status === 'PENDING');
    if (pendingRequests.length > 0) {
      throw new Error('该版本已有待审批的请求，不允许重复提交');
    }

    const changeSummary = params.changeSummary || this.generateChangeSummary(version);

    const request = new ApprovalRequest({
      contractId: params.contractId,
      contractVersionId: params.contractVersionId,
      requestedBy: params.requestedBy,
      approvalType: params.approvalType || this.mapChangeTypeToApprovalType(version.changeType),
      changeSummary: changeSummary,
      status: 'PENDING',
      requestedAt: new Date().toISOString()
    });

    store.saveApprovalRequest(request);

    version.status = 'PENDING_APPROVAL';
    version.updatedAt = new Date().toISOString();
    store.saveContractVersion(version);

    return request;
  }

  static mapChangeTypeToApprovalType(changeType) {
    const mapping = {
      'CREATE': 'NEW_CONTRACT',
      'AMOUNT_CHANGE': 'AMOUNT_CHANGE',
      'TAX_RATE_CHANGE': 'TAX_RATE_CHANGE',
      'ITEM_CHANGE': 'ITEM_CHANGE',
      'RECALCULATION': 'RECALCULATION'
    };
    return mapping[changeType] || 'NEW_CONTRACT';
  }

  static generateChangeSummary(version) {
    const latestVersion = store.getLatestVersionByContractId(version.contractId);
    const basedOnVersion = version.basedOnVersionId 
      ? ContractVersionService.getVersionById(version.basedOnVersionId)
      : null;

    if (!basedOnVersion) {
      return `新建合同，含税价 ${version.amountWithTax} 元，税率 ${version.getTaxRatePercentage()}`;
    }

    const comparison = ContractVersionService.generateVersionComparison(basedOnVersion, version);
    return `版本 ${basedOnVersion.versionNo} → ${version.versionNo}：${comparison.businessSummary.impact}`;
  }

  static approveApprovalRequest(requestId, approvedBy, comments = []) {
    const request = store.getApprovalRequestById(requestId);
    if (!request) {
      throw new Error(`审批请求 ${requestId} 不存在`);
    }

    if (request.status !== 'PENDING') {
      throw new Error(`审批请求状态为 ${request.getStatusDescription()}，不允许重复审批`);
    }

    request.status = 'APPROVED';
    request.approvedBy = approvedBy;
    request.approvedAt = new Date().toISOString();
    if (comments && comments.length > 0) {
      request.comments = [...request.comments, ...comments.map(c => ({
        content: c,
        by: approvedBy,
        at: new Date().toISOString(),
        type: 'APPROVAL'
      }))];
    }
    store.saveApprovalRequest(request);

    const result = ContractVersionService.activateVersion(request.contractVersionId);

    return {
      request: request,
      result: {
        version: result.version,
        contract: result.contract,
        businessSummary: {
          message: '审批通过，版本已生效',
          contractNo: result.contract.contractNo,
          versionNo: result.version.versionNo,
          status: result.version.getStatusDescription()
        }
      }
    };
  }

  static rejectApprovalRequest(requestId, rejectedBy, rejectionReason, comments = []) {
    if (!rejectionReason) {
      throw new Error('驳回请求必须提供驳回理由');
    }

    const request = store.getApprovalRequestById(requestId);
    if (!request) {
      throw new Error(`审批请求 ${requestId} 不存在`);
    }

    if (request.status !== 'PENDING') {
      throw new Error(`审批请求状态为 ${request.getStatusDescription()}，不允许重复审批`);
    }

    request.status = 'REJECTED';
    request.approvedBy = rejectedBy;
    request.approvedAt = new Date().toISOString();
    request.rejectionReason = rejectionReason;
    
    const allComments = [
      {
        content: `驳回理由：${rejectionReason}`,
        by: rejectedBy,
        at: new Date().toISOString(),
        type: 'REJECTION'
      },
      ...comments.map(c => ({
        content: c,
        by: rejectedBy,
        at: new Date().toISOString(),
        type: 'COMMENT'
      }))
    ];
    request.comments = [...request.comments, ...allComments];
    
    store.saveApprovalRequest(request);

    const version = ContractVersionService.getVersionById(request.contractVersionId);
    if (version) {
      version.status = 'REJECTED';
      version.approvalStatus = 'REJECTED';
      version.updatedAt = new Date().toISOString();
      store.saveContractVersion(version);
    }

    return {
      request: request,
      result: {
        version: version,
        businessSummary: {
          message: '审批已驳回，请根据驳回理由修改后重新提交',
          contractId: request.contractId,
          versionId: request.contractVersionId,
          rejectionReason: rejectionReason
        }
      }
    };
  }

  static getApprovalRequestById(id) {
    return store.getApprovalRequestById(id);
  }

  static getApprovalRequestsByContractId(contractId) {
    return store.getApprovalRequestsByContractId(contractId);
  }

  static getPendingApprovalRequests() {
    const allRequests = [];
    for (const req of store.approvalRequests.values()) {
      if (req.status === 'PENDING') {
        allRequests.push(req);
      }
    }
    return allRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  }

  static generateApprovalReport(request) {
    const version = ContractVersionService.getVersionById(request.contractVersionId);
    const contract = ContractVersionService.getContractById(request.contractId);

    return {
      requestInfo: {
        id: request.id,
        approvalType: request.approvalType,
        approvalTypeDescription: request.getApprovalTypeDescription(),
        status: request.status,
        statusDescription: request.getStatusDescription(),
        requestedBy: request.requestedBy,
        requestedAt: request.requestedAt,
        approvedBy: request.approvedBy,
        approvedAt: request.approvedAt
      },
      contractInfo: contract ? {
        id: contract.id,
        contractNo: contract.contractNo,
        title: contract.title,
        partyA: contract.partyA,
        partyB: contract.partyB
      } : null,
      versionInfo: version ? {
        id: version.id,
        versionNo: version.versionNo,
        changeType: version.changeType,
        changeTypeDescription: version.getChangeTypeDescription(),
        amountWithTax: version.amountWithTax,
        amountWithoutTax: version.amountWithoutTax,
        taxAmount: version.taxAmount,
        taxRatePercentage: version.getTaxRatePercentage()
      } : null,
      changeSummary: request.changeSummary,
      rejectionReason: request.rejectionReason,
      comments: request.comments
    };
  }
}

module.exports = ApprovalService;

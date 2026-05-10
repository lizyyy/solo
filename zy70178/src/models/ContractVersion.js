const { v4: uuidv4 } = require('uuid');

class ContractVersion {
  constructor(params) {
    this.id = params.id || uuidv4();
    this.contractId = params.contractId;
    this.versionNo = params.versionNo;
    this.versionDescription = params.versionDescription || '';
    this.totalAmount = params.totalAmount;
    this.taxRuleId = params.taxRuleId;
    this.taxRuleCode = params.taxRuleCode;
    this.taxRate = params.taxRate;
    this.priceType = params.priceType;
    this.amountWithTax = params.amountWithTax;
    this.amountWithoutTax = params.amountWithoutTax;
    this.taxAmount = params.taxAmount;
    this.items = params.items || [];
    this.basedOnVersionId = params.basedOnVersionId || null;
    this.changeType = params.changeType || 'CREATE';
    this.status = params.status || 'PENDING_APPROVAL';
    this.approvalStatus = params.approvalStatus || 'PENDING';
    this.approvedBy = params.approvedBy || null;
    this.approvedAt = params.approvedAt || null;
    this.createdBy = params.createdBy;
    this.createdAt = params.createdAt || new Date().toISOString();
  }

  getTaxRatePercentage() {
    return (this.taxRate * 100).toFixed(2) + '%';
  }

  getPriceTypeDescription() {
    const descriptions = {
      'WITH_TAX': '含税价',
      'WITHOUT_TAX': '不含税价',
      'TOTAL_AMOUNT': '合同总金额'
    };
    return descriptions[this.priceType] || this.priceType;
  }

  getStatusDescription() {
    const descriptions = {
      'DRAFT': '草稿',
      'PENDING_APPROVAL': '待审批',
      'APPROVED': '已审批',
      'REJECTED': '已驳回',
      'ACTIVE': '生效中'
    };
    return descriptions[this.status] || this.status;
  }

  getChangeTypeDescription() {
    const descriptions = {
      'CREATE': '新建合同',
      'AMOUNT_CHANGE': '金额变更',
      'TAX_RATE_CHANGE': '税率变更',
      'ITEM_CHANGE': '明细变更',
      'RECALCULATION': '历史重算'
    };
    return descriptions[this.changeType] || this.changeType;
  }

  toJSON() {
    return {
      id: this.id,
      contractId: this.contractId,
      versionNo: this.versionNo,
      versionDescription: this.versionDescription,
      totalAmount: this.totalAmount,
      taxRuleId: this.taxRuleId,
      taxRuleCode: this.taxRuleCode,
      taxRate: this.taxRate,
      taxRatePercentage: this.getTaxRatePercentage(),
      priceType: this.priceType,
      priceTypeDescription: this.getPriceTypeDescription(),
      amountWithTax: this.amountWithTax,
      amountWithoutTax: this.amountWithoutTax,
      taxAmount: this.taxAmount,
      items: this.items.map(item => ({
        ...item,
        taxRatePercentage: (item.taxRate * 100).toFixed(2) + '%'
      })),
      basedOnVersionId: this.basedOnVersionId,
      changeType: this.changeType,
      changeTypeDescription: this.getChangeTypeDescription(),
      status: this.status,
      statusDescription: this.getStatusDescription(),
      approvalStatus: this.approvalStatus,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
      createdBy: this.createdBy,
      createdAt: this.createdAt
    };
  }
}

module.exports = ContractVersion;

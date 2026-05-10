const { v4: uuidv4 } = require('uuid');

class Contract {
  constructor(params) {
    this.id = params.id || uuidv4();
    this.contractNo = params.contractNo;
    this.title = params.title;
    this.partyA = params.partyA;
    this.partyB = params.partyB;
    this.signDate = params.signDate;
    this.effectiveDate = params.effectiveDate;
    this.expiryDate = params.expiryDate || null;
    this.industry = params.industry;
    this.currentVersionId = params.currentVersionId || null;
    this.status = params.status || 'DRAFT';
    this.createdBy = params.createdBy;
    this.createdAt = params.createdAt || new Date().toISOString();
    this.updatedAt = params.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      contractNo: this.contractNo,
      title: this.title,
      partyA: this.partyA,
      partyB: this.partyB,
      signDate: this.signDate,
      effectiveDate: this.effectiveDate,
      expiryDate: this.expiryDate,
      industry: this.industry,
      currentVersionId: this.currentVersionId,
      status: this.status,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Contract;

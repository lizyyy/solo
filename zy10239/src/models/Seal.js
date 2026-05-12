const { v4: uuidv4 } = require('uuid');

class Seal {
  constructor(id, name, type, description) {
    this.id = id || uuidv4();
    this.name = name;
    this.type = type;
    this.description = description;
    this.status = 'available';
    this.createdAt = new Date().toISOString();
  }
}

class SealApplication {
  constructor(sealId, applicantId, applicantName, purpose, expectedLendDate, expectedReturnDate, reason) {
    this.id = uuidv4();
    this.sealId = sealId;
    this.applicantId = applicantId;
    this.applicantName = applicantName;
    this.purpose = purpose;
    this.expectedLendDate = expectedLendDate;
    this.expectedReturnDate = expectedReturnDate;
    this.reason = reason;
    this.status = 'pending';
    this.approverId = null;
    this.approverName = null;
    this.approvalTime = null;
    this.approvalRemark = null;
    this.actualLendDate = null;
    this.actualReturnDate = null;
    this.lenderId = null;
    this.lenderName = null;
    this.returnerId = null;
    this.returnerName = null;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
}

const seals = new Map();
const applications = new Map();

function initSampleData() {
  const seal1 = new Seal(null, '公司公章', 'official', '公司行政公章');
  const seal2 = new Seal(null, '财务专用章', 'finance', '财务部门专用章');
  const seal3 = new Seal(null, '合同专用章', 'contract', '合同签订专用章');
  
  seals.set(seal1.id, seal1);
  seals.set(seal2.id, seal2);
  seals.set(seal3.id, seal3);
}

module.exports = {
  Seal,
  SealApplication,
  seals,
  applications,
  initSampleData
};
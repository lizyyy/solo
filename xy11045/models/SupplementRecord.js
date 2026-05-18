const SUPPLEMENT_STATUSES = [
  '待审核',
  '已审核待打印',
  '已打印待寄出',
  '已寄出',
  '已签收',
  '需人工确认',
  '已取消'
];

const STATUS_FLOW = {
  '待审核': ['已审核待打印', '需人工确认', '已取消'],
  '已审核待打印': ['已打印待寄出', '需人工确认'],
  '已打印待寄出': ['已寄出', '需人工确认'],
  '已寄出': ['已签收', '需人工确认'],
  '已签收': [],
  '需人工确认': ['待审核', '已审核待打印', '已打印待寄出', '已寄出', '已签收', '已取消'],
  '已取消': []
};

const REQUIRED_FIELDS = [
  'batchNumber',
  'physicalExaminationCenter',
  'reportType',
  'examineeName',
  'examineeIdCard',
  'examineePhone',
  'originalMailingAddress',
  'correctedMailingAddress',
  'originalRecipient',
  'correctedRecipient',
  'originalPhone',
  'correctedPhone',
  'supplementReason',
  'reportPrintDate',
  'supplementApplyDate',
  'courierCompany',
  'status',
  'operator'
];

class SupplementRecord {
  constructor(data) {
    this.supplementId = data.supplementId || this.generateId();
    this.batchNumber = data.batchNumber;
    this.physicalExaminationCenter = data.physicalExaminationCenter;
    this.reportType = data.reportType;
    this.examineeName = data.examineeName;
    this.examineeIdCard = data.examineeIdCard;
    this.examineePhone = data.examineePhone;
    this.unitName = data.unitName;
    this.unitId = data.unitId;
    this.originalMailingAddress = data.originalMailingAddress;
    this.correctedMailingAddress = data.correctedMailingAddress;
    this.originalRecipient = data.originalRecipient;
    this.correctedRecipient = data.correctedRecipient;
    this.originalPhone = data.originalPhone;
    this.correctedPhone = data.correctedPhone;
    this.supplementReason = data.supplementReason;
    this.reportPrintDate = data.reportPrintDate;
    this.originalShipDate = data.originalShipDate;
    this.supplementApplyDate = data.supplementApplyDate;
    this.courierCompany = data.courierCompany;
    this.trackingNumber = data.trackingNumber;
    this.status = data.status;
    this.manualRemarks = data.manualRemarks;
    this.operator = data.operator;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  generateId() {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `SUP${dateStr}${random}`;
  }

  toJSON() {
    return {
      supplementId: this.supplementId,
      batchNumber: this.batchNumber,
      physicalExaminationCenter: this.physicalExaminationCenter,
      reportType: this.reportType,
      examineeName: this.examineeName,
      examineeIdCard: this.examineeIdCard,
      examineePhone: this.examineePhone,
      unitName: this.unitName,
      unitId: this.unitId,
      originalMailingAddress: this.originalMailingAddress,
      correctedMailingAddress: this.correctedMailingAddress,
      originalRecipient: this.originalRecipient,
      correctedRecipient: this.correctedRecipient,
      originalPhone: this.originalPhone,
      correctedPhone: this.correctedPhone,
      supplementReason: this.supplementReason,
      reportPrintDate: this.reportPrintDate,
      originalShipDate: this.originalShipDate,
      supplementApplyDate: this.supplementApplyDate,
      courierCompany: this.courierCompany,
      trackingNumber: this.trackingNumber,
      status: this.status,
      manualRemarks: this.manualRemarks,
      operator: this.operator,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = {
  SupplementRecord,
  SUPPLEMENT_STATUSES,
  STATUS_FLOW,
  REQUIRED_FIELDS
};

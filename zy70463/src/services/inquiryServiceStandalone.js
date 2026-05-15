const store = require('../storage/memoryStore');

async function createInquiry(inquiryData) {
  return store.createInquiry(inquiryData);
}

async function addItemRemark(inquiryId, lineNumber, remark) {
  const inquiry = store.findInquiryById(inquiryId);
  if (!inquiry) {
    throw new Error('询价单不存在');
  }

  const item = inquiry.items.find(item => item.lineNumber === lineNumber);
  if (!item) {
    throw new Error(`行号 ${lineNumber} 不存在`);
  }

  item.manualRemark = remark;
  return store.updateInquiry(inquiryId, { items: inquiry.items });
}

async function getItemByLineNumber(inquiryId, lineNumber) {
  const inquiry = store.findInquiryById(inquiryId);
  if (!inquiry) {
    throw new Error('询价单不存在');
  }

  const item = inquiry.items.find(item => item.lineNumber === lineNumber);
  if (!item) {
    throw new Error(`行号 ${lineNumber} 不存在`);
  }

  return item;
}

async function updateOverallRemark(inquiryId, remark) {
  const inquiry = store.findInquiryById(inquiryId);
  if (!inquiry) {
    throw new Error('询价单不存在');
  }

  return store.updateInquiry(inquiryId, { overallRemark: remark });
}

async function getInquiryById(inquiryId) {
  return store.findInquiryById(inquiryId);
}

async function getAllInquiries(filters = {}) {
  return store.findInquiries(filters);
}

async function generateInquiryReport(inquiryId) {
  const inquiry = store.findInquiryById(inquiryId);
  if (!inquiry) {
    throw new Error('询价单不存在');
  }

  return {
    inquiryNo: inquiry.inquiryNo,
    title: inquiry.title,
    applicant: inquiry.applicant,
    applicantDepartment: inquiry.applicantDepartment,
    overallRemark: inquiry.overallRemark,
    items: inquiry.items.map(item => ({
      lineNumber: item.lineNumber,
      itemName: item.itemName,
      specification: item.specification,
      quantity: item.quantity,
      unit: item.unit,
      estimatedPrice: item.estimatedPrice,
      manualRemark: item.manualRemark || null,
      reservationId: item.reservationId || null
    })),
    status: inquiry.status,
    generatedAt: new Date()
  };
}

module.exports = {
  createInquiry,
  addItemRemark,
  getItemByLineNumber,
  updateOverallRemark,
  getInquiryById,
  getAllInquiries,
  generateInquiryReport
};

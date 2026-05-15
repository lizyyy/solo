const PurchaseInquiry = require('../models/PurchaseInquiry');

function generateInquiryNo() {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INQ${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${timestamp}${random}`;
}

async function createInquiry(inquiryData) {
  const inquiryNo = generateInquiryNo();
  
  const inquiry = new PurchaseInquiry({
    ...inquiryData,
    inquiryNo,
    status: 'draft'
  });
  
  await inquiry.save();
  return inquiry;
}

async function addItemRemark(inquiryId, lineNumber, remark) {
  const inquiry = await PurchaseInquiry.findById(inquiryId);
  if (!inquiry) {
    throw new Error('询价单不存在');
  }
  
  const item = inquiry.items.find(item => item.lineNumber === lineNumber);
  if (!item) {
    throw new Error(`行号 ${lineNumber} 不存在`);
  }
  
  item.manualRemark = remark;
  await inquiry.save();
  
  return inquiry;
}

async function getItemByLineNumber(inquiryId, lineNumber) {
  const inquiry = await PurchaseInquiry.findById(inquiryId);
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
  const inquiry = await PurchaseInquiry.findById(inquiryId);
  if (!inquiry) {
    throw new Error('询价单不存在');
  }
  
  inquiry.overallRemark = remark;
  await inquiry.save();
  
  return inquiry;
}

async function getInquiryById(inquiryId) {
  return await PurchaseInquiry.findById(inquiryId);
}

async function getAllInquiries(filters = {}) {
  const query = {};
  if (filters.status) {
    query.status = filters.status;
  }
  
  return await PurchaseInquiry.find(query).sort({ createdAt: -1 });
}

async function generateInquiryReport(inquiryId) {
  const inquiry = await PurchaseInquiry.findById(inquiryId);
  if (!inquiry) {
    throw new Error('询价单不存在');
  }
  
  const report = {
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
      manualRemark: item.manualRemark,
      reservationId: item.reservationId
    })),
    status: inquiry.status,
    generatedAt: new Date()
  };
  
  return report;
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

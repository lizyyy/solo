const crypto = require('crypto');
const moment = require('moment');

const SECURITY_LEVEL_ORDER = {
  '公开': 1,
  '内部': 2,
  '秘密': 3,
  '机密': 4,
  '绝密': 5
};

const generateId = (prefix) => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
};

const formatDate = (date) => {
  return moment(date).format('YYYY-MM-DD HH:mm:ss');
};

const calculateOverdueDays = (dueDate, returnDate = null) => {
  const now = returnDate || new Date();
  const due = new Date(dueDate);
  if (now > due) {
    return Math.ceil((now - due) / (1000 * 60 * 60 * 24));
  }
  return 0;
};

const canAccessSecretLevel = (userLevel, caseLevel) => {
  return SECURITY_LEVEL_ORDER[userLevel] >= SECURITY_LEVEL_ORDER[caseLevel];
};

const getReadableOverdueMessage = (overdueDays, borrowerName) => {
  if (overdueDays <= 0) return null;
  
  if (overdueDays === 1) {
    return `${borrowerName}借阅已超期1天，请立即归还或办理续借手续`;
  } else if (overdueDays < 7) {
    return `${borrowerName}借阅已超期${overdueDays}天，超期时间较短，建议尽快归还`;
  } else if (overdueDays < 30) {
    return `${borrowerName}借阅已超期${overdueDays}天，已超过一周，请尽快联系归还`;
  } else {
    return `${borrowerName}借阅已超期${overdueDays}天，严重超期，需立即采取催还措施并记录原因`;
  }
};

const getReadableSecretMessage = (caseLevel, userLevel, caseTitle) => {
  return `案件「${caseTitle}」密级为「${caseLevel}」，借阅人权限仅为「${userLevel}」，需进行涉密审查和特殊审批`;
};

const getReadableRenewMessage = (currentCount, maxCount, borrowerName) => {
  if (currentCount >= maxCount) {
    return `${borrowerName}已达到续借上限（${maxCount}次），无法继续续借，请归还后重新申请`;
  } else if (currentCount === maxCount - 1) {
    return `${borrowerName}当前已续借${currentCount}次，仅剩1次续借机会`;
  }
  return `${borrowerName}当前已续借${currentCount}次，最多可续借${maxCount}次`;
};

const validateCSVRow = (row, type) => {
  const errors = [];
  
  if (type === 'borrow') {
    if (!row.caseId) errors.push('缺少案件编号(caseId)');
    if (!row.borrowerId) errors.push('缺少借阅人ID(borrowerId)');
    if (!row.borrowerName) errors.push('缺少借阅人姓名(borrowerName)');
    if (!row.borrowDate) errors.push('缺少借阅日期(borrowDate)');
    if (!row.dueDate) errors.push('缺少应还日期(dueDate)');
  } else if (type === 'case') {
    if (!row.caseId) errors.push('缺少案件编号(caseId)');
    if (!row.title) errors.push('缺少案件标题(title)');
    if (!row.securityLevel) errors.push('缺少密级(securityLevel)');
  } else if (type === 'permission') {
    if (!row.userId) errors.push('缺少用户ID(userId)');
    if (!row.username) errors.push('缺少用户姓名(username)');
    if (!row.maxSecurityLevel) errors.push('缺少最高可借阅密级(maxSecurityLevel)');
  }
  
  return errors;
};

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY/MM/DD HH:mm:ss',
    'DD-MM-YYYY',
    'DD/MM/YYYY'
  ];
  
  for (const format of formats) {
    const parsed = moment(dateStr, format, true);
    if (parsed.isValid()) {
      return parsed.toDate();
    }
  }
  
  return new Date(dateStr);
};

module.exports = {
  generateId,
  formatDate,
  calculateOverdueDays,
  canAccessSecretLevel,
  getReadableOverdueMessage,
  getReadableSecretMessage,
  getReadableRenewMessage,
  validateCSVRow,
  parseDate,
  SECURITY_LEVEL_ORDER
};

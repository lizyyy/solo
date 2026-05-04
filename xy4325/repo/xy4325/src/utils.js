require('dotenv').config();

const DEFAULT_BORROW_DAYS = parseInt(process.env.DEFAULT_BORROW_DAYS) || 7;
const RISK_LEVEL_1_DAYS = parseInt(process.env.RISK_LEVEL_1_DAYS) || 1;
const RISK_LEVEL_2_DAYS = parseInt(process.env.RISK_LEVEL_2_DAYS) || 3;
const RISK_LEVEL_3_DAYS = parseInt(process.env.RISK_LEVEL_3_DAYS) || 7;

function getDueDate(borrowDate = new Date(), borrowDays = DEFAULT_BORROW_DAYS) {
  const due = new Date(borrowDate);
  due.setDate(due.getDate() + borrowDays);
  return due;
}

function calculateOverdueDays(dueDate, currentDate = new Date()) {
  const due = new Date(dueDate);
  const current = new Date(currentDate);
  const diffTime = current.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

function calculateRiskLevel(overdueDays) {
  if (overdueDays <= 0) return 0;
  if (overdueDays <= RISK_LEVEL_1_DAYS) return 1;
  if (overdueDays <= RISK_LEVEL_2_DAYS) return 2;
  if (overdueDays <= RISK_LEVEL_3_DAYS) return 3;
  return 4;
}

function getRiskLevelDescription(level) {
  const descriptions = {
    0: '正常',
    1: '轻微超期',
    2: '中度超期',
    3: '严重超期',
    4: '极高风险'
  };
  return descriptions[level] || '未知';
}

function formatDate(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return date.toISOString().split('T')[0];
}

function formatDateTime(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

module.exports = {
  getDueDate,
  calculateOverdueDays,
  calculateRiskLevel,
  getRiskLevelDescription,
  formatDate,
  formatDateTime,
  DEFAULT_BORROW_DAYS
};

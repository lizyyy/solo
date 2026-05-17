const { v4: uuidv4 } = require('uuid');

const generateId = () => uuidv4();

const validateRiskLevel = (level) => {
  const validLevels = ['low', 'medium', 'high', 'critical'];
  return validLevels.includes(level.toLowerCase());
};

const validateStatus = (status) => {
  const validStatuses = ['pending', 'approved', 'rejected', 'in_progress', 'completed', 'failed', 'expired'];
  return validStatuses.includes(status.toLowerCase());
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const getRiskLevelDescription = (level) => {
  const descriptions = {
    'low': '低风险 - 影响范围小，易于回滚',
    'medium': '中风险 - 有一定影响，需要测试验证',
    'high': '高风险 - 影响核心功能，需要详细评审',
    'critical': '极高风险 - 生产紧急问题，需要最高级别审批'
  };
  return descriptions[level.toLowerCase()] || level;
};

const getStatusDescription = (status) => {
  const descriptions = {
    'pending': '待审批 - 等待审批人审核',
    'approved': '已批准 - 已获得审批，可以在放行窗口内执行',
    'rejected': '已拒绝 - 审批不通过，不能执行',
    'in_progress': '进行中 - 正在执行修复',
    'completed': '已完成 - 修复已完成并验证',
    'failed': '失败 - 修复执行失败',
    'expired': '已过期 - 放行窗口已过，未执行'
  };
  return descriptions[status.toLowerCase()] || status;
};

const isWindowExpired = (windowEnd) => {
  if (!windowEnd) return false;
  return new Date() > new Date(windowEnd);
};

const safeJsonParse = (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
};

module.exports = {
  generateId,
  validateRiskLevel,
  validateStatus,
  formatDate,
  getRiskLevelDescription,
  getStatusDescription,
  isWindowExpired,
  safeJsonParse
};

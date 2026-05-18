const Joi = require('joi');
const { DISPATCH_STATUS, APPLIANCE_TYPES, ISSUE_TYPES } = require('../models/dispatch');

const dispatchSchema = Joi.object({
  orderNo: Joi.string().required().messages({
    'string.empty': '订单编号不能为空',
    'any.required': '订单编号是必填字段'
  }),
  customerName: Joi.string().required().messages({
    'string.empty': '客户姓名不能为空',
    'any.required': '客户姓名是必填字段'
  }),
  customerPhone: Joi.string().pattern(/^1[3-9]\d{9}$/).required().messages({
    'string.pattern.base': '手机号码格式不正确，必须是11位有效手机号',
    'string.empty': '客户电话不能为空',
    'any.required': '客户电话是必填字段'
  }),
  customerAddress: Joi.string().min(10).required().messages({
    'string.min': '客户地址至少需要10个字符，请填写详细地址',
    'string.empty': '客户地址不能为空',
    'any.required': '客户地址是必填字段'
  }),
  applianceType: Joi.string().valid(...Object.values(APPLIANCE_TYPES)).required().messages({
    'any.only': '家电类型必须是有效值：' + Object.values(APPLIANCE_TYPES).join(', '),
    'any.required': '家电类型是必填字段'
  }),
  applianceBrand: Joi.string().required().messages({
    'string.empty': '家电品牌不能为空',
    'any.required': '家电品牌是必填字段'
  }),
  applianceModel: Joi.string().required().messages({
    'string.empty': '家电型号不能为空',
    'any.required': '家电型号是必填字段'
  }),
  installationType: Joi.string().valid('new_install', 'reinstall', 'repair').required().messages({
    'any.only': '安装类型必须是: new_install(新装), reinstall(重装), repair(维修)',
    'any.required': '安装类型是必填字段'
  }),
  scheduledDate: Joi.string().isoDate().required().messages({
    'string.isoDate': '预约日期格式不正确，应为YYYY-MM-DD',
    'any.required': '预约日期是必填字段'
  }),
  timeSlotStart: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
    'string.pattern.base': '开始时间格式不正确，应为HH:MM',
    'any.required': '开始时间是必填字段'
  }),
  timeSlotEnd: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
    'string.pattern.base': '结束时间格式不正确，应为HH:MM',
    'any.required': '结束时间是必填字段'
  }),
  technicianId: Joi.string().required().messages({
    'string.empty': '师傅ID不能为空',
    'any.required': '师傅ID是必填字段'
  }),
  technicianName: Joi.string().required().messages({
    'string.empty': '师傅姓名不能为空',
    'any.required': '师傅姓名是必填字段'
  }),
  technicianPhone: Joi.string().pattern(/^1[3-9]\d{9}$/).required().messages({
    'string.pattern.base': '师傅手机号码格式不正确',
    'any.required': '师傅电话是必填字段'
  }),
  technicianTeam: Joi.string().required().messages({
    'string.empty': '所属班组不能为空',
    'any.required': '所属班组是必填字段'
  }),
  status: Joi.string().valid(...Object.values(DISPATCH_STATUS)).default(DISPATCH_STATUS.PENDING),
  installationFee: Joi.number().min(0).default(0),
  materialFee: Joi.number().min(0).default(0),
  totalFee: Joi.number().min(0).default(0),
  notes: Joi.string().allow('').default(''),
  auditStatus: Joi.string().valid('pending', 'passed', 'failed').default('pending'),
  auditNotes: Joi.string().allow('').default('')
});

const statusTransitionRules = {
  [DISPATCH_STATUS.PENDING]: [DISPATCH_STATUS.LOCKED, DISPATCH_STATUS.CANCELLED],
  [DISPATCH_STATUS.LOCKED]: [DISPATCH_STATUS.DISPATCHED, DISPATCH_STATUS.CANCELLED, DISPATCH_STATUS.PENDING],
  [DISPATCH_STATUS.DISPATCHED]: [DISPATCH_STATUS.ACCEPTED, DISPATCH_STATUS.CANCELLED],
  [DISPATCH_STATUS.ACCEPTED]: [DISPATCH_STATUS.IN_PROGRESS, DISPATCH_STATUS.CANCELLED],
  [DISPATCH_STATUS.IN_PROGRESS]: [DISPATCH_STATUS.COMPLETED, DISPATCH_STATUS.CANCELLED],
  [DISPATCH_STATUS.COMPLETED]: [],
  [DISPATCH_STATUS.CANCELLED]: [],
  [DISPATCH_STATUS.NEEDS_REVIEW]: [DISPATCH_STATUS.PENDING, DISPATCH_STATUS.CANCELLED]
};

function validateDispatchData(data) {
  const { error, value } = dispatchSchema.validate(data, { abortEarly: false });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path[0],
      message: detail.message,
      suggestion: getFieldSuggestion(detail.path[0], detail)
    }));
    return { valid: false, errors, value };
  }
  
  return { valid: true, errors: [], value };
}

function getFieldSuggestion(field, detail) {
  const suggestions = {
    orderNo: '请检查订单编号是否正确，格式如：DD202405010001',
    customerName: '请填写客户真实姓名',
    customerPhone: '请填写11位有效手机号码，如：13800138000',
    customerAddress: '请填写详细地址，包含省市区街道门牌号',
    applianceType: '请选择正确的家电类型：' + Object.values(APPLIANCE_TYPES).join(', '),
    applianceBrand: '请填写家电品牌，如：格力、美的、海尔',
    applianceModel: '请填写具体型号，如：KFR-35GW/(35592)FNhAa-B1',
    installationType: '请选择：new_install(新装), reinstall(重装), repair(维修)',
    scheduledDate: '请使用YYYY-MM-DD格式，如：2024-05-20',
    timeSlotStart: '请使用HH:MM格式，如：09:00',
    timeSlotEnd: '请使用HH:MM格式，如：12:00，且必须晚于开始时间',
    technicianId: '请填写师傅在系统中的唯一ID',
    technicianName: '请填写师傅真实姓名',
    technicianPhone: '请填写师傅的11位手机号码',
    technicianTeam: '请填写所属班组，如：城东一组、空调专业组'
  };
  return suggestions[field] || '请检查该字段格式是否正确';
}

function validateStatusTransition(currentStatus, targetStatus) {
  const allowedTransitions = statusTransitionRules[currentStatus];
  if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
    return {
      valid: false,
      reason: `状态从 ${currentStatus} 不能直接变更为 ${targetStatus}`,
      suggestion: `允许的状态变更为: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : '（终态，不可变更）'}`
    };
  }
  return { valid: true };
}

function checkTimeSlotOverlap(newOrder, existingOrders) {
  const overlappingOrders = existingOrders.filter(order => {
    if (order.technicianId !== newOrder.technicianId) return false;
    if (order.scheduledDate !== newOrder.scheduledDate) return false;
    if (order.status === DISPATCH_STATUS.CANCELLED || order.status === DISPATCH_STATUS.COMPLETED) return false;
    
    const newStart = parseTime(newOrder.timeSlotStart);
    const newEnd = parseTime(newOrder.timeSlotEnd);
    const existingStart = parseTime(order.timeSlotStart);
    const existingEnd = parseTime(order.timeSlotEnd);
    
    return (newStart < existingEnd && newEnd > existingStart);
  });
  
  if (overlappingOrders.length > 0) {
    return {
      hasOverlap: true,
      overlappingOrders: overlappingOrders.map(o => ({
        orderNo: o.orderNo,
        timeSlot: `${o.timeSlotStart}-${o.timeSlotEnd}`,
        status: o.status
      })),
      reason: `师傅 ${newOrder.technicianName} 在 ${newOrder.scheduledDate} ${newOrder.timeSlotStart}-${newOrder.timeSlotEnd} 时段已有 ${overlappingOrders.length} 个重叠订单`,
      suggestion: '建议：1) 调整时段 2) 经人工确认后标记为"特殊情况允许重叠"继续推进'
    };
  }
  
  return { hasOverlap: false };
}

function checkAuditConsistency(order) {
  const issues = [];
  
  if (order.status === DISPATCH_STATUS.COMPLETED && !order.completeTime) {
    issues.push({
      field: 'completeTime',
      reason: '订单标记为已完成但缺少完成时间',
      suggestion: '补充完成时间或经人工备注说明原因后继续'
    });
  }
  
  if (order.status === DISPATCH_STATUS.ACCEPTED && !order.acceptTime) {
    issues.push({
      field: 'acceptTime',
      reason: '订单标记为已接单但缺少接单时间',
      suggestion: '补充接单时间或经人工备注说明原因后继续'
    });
  }
  
  if (order.totalFee > 0 && order.installationFee + order.materialFee !== order.totalFee) {
    issues.push({
      field: 'totalFee',
      reason: `总金额 ${order.totalFee} 不等于安装费 ${order.installationFee} 加材料费 ${order.materialFee}`,
      suggestion: '重新核算金额或经人工备注说明原因后继续'
    });
  }
  
  return {
    consistent: issues.length === 0,
    issues: issues
  };
}

function checkDuplicateOrder(newOrder, existingOrders) {
  const duplicates = existingOrders.filter(order => 
    order.orderNo === newOrder.orderNo && 
    order.id !== newOrder.id
  );
  
  if (duplicates.length > 0) {
    return {
      isDuplicate: true,
      duplicateOrders: duplicates.map(o => ({
        id: o.id,
        orderNo: o.orderNo,
        status: o.status,
        createdAt: o.createdAt
      })),
      reason: `订单编号 ${newOrder.orderNo} 已存在，共 ${duplicates.length} 条重复记录`,
      suggestion: '建议：1) 检查是否重复导入 2) 确认是更新操作还是新单导入 3) 经人工确认后标记继续'
    };
  }
  
  return { isDuplicate: false };
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

module.exports = {
  validateDispatchData,
  validateStatusTransition,
  checkTimeSlotOverlap,
  checkAuditConsistency,
  checkDuplicateOrder
};

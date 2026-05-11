const attendeeModel = require('../models/attendee');
const historyModel = require('../models/history');

const VALID_REPRINT_REASONS = [
  '胸牌丢失',
  '公司名称变更',
  '姓名更正',
  '胸牌损坏',
  '权限区域调整',
  '临时添加权限',
  '首次打印',
  '其他'
];

function validateImportData(data) {
  const errors = [];
  const warnings = [];
  const info = [];
  
  const requiredFields = ['name', 'company', 'badgeNumber', 'guestType'];
  
  for (const field of requiredFields) {
    const fieldErrors = attendeeModel.validateField(field, data[field]);
    errors.push(...fieldErrors);
  }
  
  if (data.guestType) {
    const typeErrors = attendeeModel.validateField('guestType', data.guestType);
    errors.push(...typeErrors);
  }
  
  if (data.checkinStatus) {
    const statusErrors = attendeeModel.validateField('checkinStatus', data.checkinStatus);
    errors.push(...statusErrors);
  }
  
  if (data.permissionZone) {
    const permErrors = attendeeModel.validateField('permissionZone', data.permissionZone);
    errors.push(...permErrors);
  }
  
  const badgeNumber = data.badgeNumber;
  if (badgeNumber) {
    const existing = attendeeModel.findByBadgeNumber(badgeNumber);
    if (existing) {
      const key = attendeeModel.buildAttendeeKey(data);
      if (existing.key !== key) {
        errors.push(`编号冲突：胸牌编号 "${badgeNumber}" 已被 ${existing.name}(${existing.company}) 占用`);
      } else {
        info.push(`更新：${data.name}(${data.company}) 已存在，将更新信息`);
      }
    }
  }
  
  if (data.guestType === '临时嘉宾' && (!data.permissionZone || data.permissionZone.trim() === '')) {
    warnings.push(`权限警告：临时嘉宾 "${data.name}" 未设置权限区域，需要确认`);
  }
  
  return { errors, warnings, info, isValid: errors.length === 0 };
}

function validateReprint(attendeeData, reprintReason) {
  const errors = [];
  const warnings = [];
  const info = [];
  
  let attendee = null;
  
  if (attendeeData.badgeNumber) {
    attendee = attendeeModel.findByBadgeNumber(attendeeData.badgeNumber);
    if (!attendee) {
      warnings.push(`未找到编号为 ${attendeeData.badgeNumber} 的参会人，尝试按姓名+公司查找`);
    }
  }
  
  if (!attendee && attendeeData.name && attendeeData.company) {
    attendee = attendeeModel.findByNameAndCompany(attendeeData.name, attendeeData.company);
  }
  
  if (!attendee) {
    errors.push(`未找到参会人：${attendeeData.name || '未知'} (${attendeeData.company || '未知公司'})`);
    return { errors, warnings, info, isValid: false, attendee: null };
  }
  
  if (reprintReason && !VALID_REPRINT_REASONS.includes(reprintReason)) {
    warnings.push(`补打原因 "${reprintReason}" 不在标准原因列表中，已接受但建议确认`);
  }
  
  if (attendee.reprintCount && attendee.reprintCount >= 3) {
    warnings.push(`高频补打：${attendee.name} 已补打 ${attendee.reprintCount} 次，请确认是否异常`);
  }
  
  if (attendee.checkinStatus === '已签到') {
    warnings.push(`签到后操作：${attendee.name} 已于 ${attendee.updatedAt?.substring(0, 19).replace('T', ' ') || '未知时间'} 签到`);
  }
  
  if (attendee.guestType === '临时嘉宾' && (!attendee.permissionZone || attendee.permissionZone.trim() === '')) {
    errors.push(`权限缺失：临时嘉宾 "${attendee.name}" 未设置权限区域，无法打印胸牌`);
  }
  
  return { errors, warnings, info, isValid: errors.length === 0, attendee };
}

function validateBadgeNumberChange(attendee, newBadgeNumber) {
  const errors = [];
  const warnings = [];
  
  if (!newBadgeNumber || newBadgeNumber.trim() === '') {
    errors.push('新的胸牌编号不能为空');
    return { errors, warnings, isValid: false };
  }
  
  const formatErrors = attendeeModel.validateField('badgeNumber', newBadgeNumber);
  errors.push(...formatErrors);
  
  const existing = attendeeModel.findByBadgeNumber(newBadgeNumber);
  if (existing && existing.id !== attendee.id) {
    errors.push(`编号冲突：编号 "${newBadgeNumber}" 已被 ${existing.name}(${existing.company}) 占用`);
  }
  
  if (attendee.checkinStatus === '已签到') {
    warnings.push(`签到后换号：${attendee.name} 已签到，更换编号可能导致出入权限问题`);
  }
  
  return { errors, warnings, isValid: errors.length === 0 };
}

function validateNameChange(attendee, newName) {
  const errors = [];
  const warnings = [];
  
  if (!newName || newName.trim() === '') {
    errors.push('新姓名不能为空');
    return { errors, warnings, isValid: false };
  }
  
  if (attendee.checkinStatus === '已签到') {
    warnings.push(`签到后改名：${attendee.name} 已签到，需同步更新签到系统记录`);
  }
  
  const key = attendeeModel.buildAttendeeKey({ name: newName, company: attendee.company, phone: attendee.phone });
  const existing = attendeeModel.findByKey(key);
  if (existing && existing.id !== attendee.id) {
    errors.push(`冲突：${newName}(${attendee.company}) 已存在于系统中`);
  }
  
  return { errors, warnings, isValid: errors.length === 0 };
}

function validateCompanyChange(attendee, newCompany) {
  const errors = [];
  const warnings = [];
  
  if (!newCompany || newCompany.trim() === '') {
    errors.push('新公司名称不能为空');
    return { errors, warnings, isValid: false };
  }
  
  if (attendee.checkinStatus === '已签到') {
    warnings.push(`签到后改公司：${attendee.name} 已签到，请确认是否需要重新打印胸牌`);
  }
  
  return { errors, warnings, isValid: errors.length === 0 };
}

function validatePermissionChange(attendee, newPermission) {
  const errors = [];
  const warnings = [];
  
  if (attendee.guestType === '临时嘉宾' && (!newPermission || newPermission.trim() === '')) {
    errors.push('临时嘉宾必须设置权限区域');
    return { errors, warnings, isValid: false };
  }
  
  if (newPermission) {
    const permErrors = attendeeModel.validateField('permissionZone', newPermission);
    errors.push(...permErrors);
  }
  
  return { errors, warnings, isValid: errors.length === 0 };
}

function checkDuplicateOperation(attendeeKey, operationType, badgeNumber = null) {
  const pending = historyModel.getPendingList();
  const duplicate = pending.some(p => 
    p.attendeeKey === attendeeKey && 
    p.operationType === operationType &&
    (!badgeNumber || p.badgeNumber === badgeNumber)
  );
  return duplicate;
}

function generateBatchReport(batchData) {
  const report = {
    total: batchData.length,
    newAttendees: 0,
    updatedAttendees: 0,
    reprints: 0,
    warnings: [],
    errors: []
  };
  
  for (const item of batchData) {
    if (item.validation && item.validation.errors) {
      report.errors.push(...item.validation.errors.map(e => `${item.name}: ${e}`));
    }
    if (item.validation && item.validation.warnings) {
      report.warnings.push(...item.validation.warnings.map(w => `${item.name}: ${w}`));
    }
    
    if (item.isNew) report.newAttendees++;
    if (item.isUpdated) report.updatedAttendees++;
    if (item.isReprint) report.reprints++;
  }
  
  return report;
}

module.exports = {
  VALID_REPRINT_REASONS,
  validateImportData,
  validateReprint,
  validateBadgeNumberChange,
  validateNameChange,
  validateCompanyChange,
  validatePermissionChange,
  checkDuplicateOperation,
  generateBatchReport
};

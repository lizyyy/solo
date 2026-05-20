const store = require('../models/store');

const checkContraindications = (appointment) => {
  const rules = store.getContraindicationRules();
  const childContraindications = (appointment.contraindications || '').split(/[,，、]/).map(c => c.trim().toLowerCase());
  
  const violations = [];
  
  for (const rule of rules) {
    const ruleKeywords = rule.keywords.map(k => k.toLowerCase());
    
    const hasViolation = ruleKeywords.some(keyword => 
      childContraindications.some(c => c.includes(keyword) || keyword.includes(c))
    );
    
    if (hasViolation) {
      violations.push({
        rule: rule.name,
        description: rule.description,
        severity: rule.severity,
        suggestion: rule.suggestion
      });
    }
  }
  
  return violations;
};

const checkVaccineAvailability = (vaccineCode, appointmentDate) => {
  const vaccine = store.getVaccineInventory(vaccineCode);
  
  if (!vaccine) {
    return {
      available: false,
      status: 'unknown',
      message: `未找到疫苗编码 ${vaccineCode} 的库存信息`,
      suggestion: '请确认疫苗编码是否正确，或先上传疫苗库存数据'
    };
  }
  
  if (vaccine.quantity <= 0) {
    return {
      available: false,
      status: 'out_of_stock',
      message: `${vaccine.name} 当前库存为0，已进入缺苗候补队列`,
      suggestion: '已自动加入候补名单，到货后将按预约顺序通知，请保持电话畅通',
      expectedRestock: vaccine.expectedRestock || '待定',
      waitingListCount: vaccine.waitingListCount || 0
    };
  }
  
  if (vaccine.expiryDate) {
    const expiry = new Date(vaccine.expiryDate);
    const apptDate = new Date(appointmentDate);
    if (apptDate > expiry) {
      return {
        available: false,
        status: 'expired',
        message: `${vaccine.name} 将于 ${vaccine.expiryDate} 过期，预约日期 ${appointmentDate} 在过期之后`,
        suggestion: '请选择其他批次疫苗或调整预约日期'
      };
    }
  }
  
  return {
    available: true,
    status: 'available',
    message: `${vaccine.name} 库存充足 (剩余 ${vaccine.quantity} 剂)`,
    quantity: vaccine.quantity
  };
};

const checkDuplicateReschedule = (appointment) => {
  if (!appointment.isReschedule) {
    return { isDuplicate: false };
  }
  
  if (!appointment.originalAppointmentDate) {
    return {
      isDuplicate: false,
      warning: true,
      message: '改签预约缺少原预约日期',
      suggestion: '请补充原预约日期以便核对'
    };
  }
  
  const hasDuplicate = store.checkDuplicateReschedule(
    appointment.childId,
    appointment.vaccineCode,
    appointment.originalAppointmentDate
  );
  
  if (hasDuplicate) {
    return {
      isDuplicate: true,
      message: `该儿童 ${appointment.childId} 已对 ${appointment.vaccineCode} 疫苗在 ${appointment.originalAppointmentDate} 的预约进行过改签`,
      suggestion: '请勿重复改签，如需再次调整请先取消上次改签记录'
    };
  }
  
  return { isDuplicate: false };
};

const validateAppointment = (appointment) => {
  const result = {
    appointment,
    status: 'pending',
    issues: [],
    suggestions: []
  };
  
  const contraViolations = checkContraindications(appointment);
  if (contraViolations.length > 0) {
    const severeViolations = contraViolations.filter(v => v.severity === 'high');
    if (severeViolations.length > 0) {
      result.status = 'failed';
      result.issues.push({
        type: 'contraindication',
        severity: 'high',
        message: `存在禁忌情况: ${severeViolations.map(v => v.rule).join('、')}`,
        details: severeViolations
      });
      result.suggestions.push(...severeViolations.map(v => v.suggestion));
    } else {
      result.status = 'needs_confirmation';
      result.issues.push({
        type: 'contraindication',
        severity: 'medium',
        message: `存在需要确认的情况: ${contraViolations.map(v => v.rule).join('、')}`,
        details: contraViolations
      });
      result.suggestions.push('请医护人员电话确认儿童健康状况后再决定是否接受预约');
    }
  }
  
  const availability = checkVaccineAvailability(appointment.vaccineCode, appointment.appointmentDate);
  if (!availability.available) {
    if (availability.status === 'out_of_stock') {
      result.status = result.status === 'failed' ? 'failed' : 'waitlist';
      result.issues.push({
        type: 'out_of_stock',
        severity: 'medium',
        message: availability.message,
        details: availability
      });
      result.suggestions.push(availability.suggestion);
    } else {
      result.status = 'failed';
      result.issues.push({
        type: 'vaccine_error',
        severity: 'high',
        message: availability.message,
        details: availability
      });
      result.suggestions.push(availability.suggestion);
    }
  }
  
  const rescheduleCheck = checkDuplicateReschedule(appointment);
  if (rescheduleCheck.isDuplicate) {
    result.status = 'failed';
    result.issues.push({
      type: 'duplicate_reschedule',
      severity: 'high',
      message: rescheduleCheck.message,
      details: rescheduleCheck
    });
    result.suggestions.push(rescheduleCheck.suggestion);
  }
  
  if (result.status === 'pending') {
    result.status = 'success';
    result.message = '预约审核通过';
  }
  
  return result;
};

const processAppointments = (appointments) => {
  const success = [];
  const waitlist = [];
  const needsConfirmation = [];
  const failed = [];
  
  for (const apt of appointments) {
    const result = validateAppointment(apt);
    
    const record = {
      ...apt,
      processingResult: {
        status: result.status,
        issues: result.issues,
        suggestions: result.suggestions,
        message: result.message
      }
    };
    
    switch (result.status) {
      case 'success':
        success.push(record);
        store.addAppointment({ ...apt, status: 'confirmed' });
        break;
      case 'waitlist':
        waitlist.push(record);
        store.addAppointment({ ...apt, status: 'waitlist' });
        break;
      case 'needs_confirmation':
        needsConfirmation.push(record);
        store.addAppointment({ ...apt, status: 'pending_confirmation' });
        break;
      case 'failed':
      default:
        failed.push(record);
        break;
    }
  }
  
  return {
    summary: {
      total: appointments.length,
      success: success.length,
      waitlist: waitlist.length,
      needsConfirmation: needsConfirmation.length,
      failed: failed.length
    },
    success,
    waitlist,
    needsConfirmation,
    failed
  };
};

module.exports = {
  checkContraindications,
  checkVaccineAvailability,
  checkDuplicateReschedule,
  validateAppointment,
  processAppointments
};

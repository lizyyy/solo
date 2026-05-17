const Joi = require('joi');
const moment = require('moment');
const { CompensationRecord, Room, User } = require('../models');

const validationSchema = Joi.object({
  reservationId: Joi.string().required().messages({
    'string.empty': '预约ID不能为空',
    'any.required': '预约ID是必填项'
  }),
  roomId: Joi.number().integer().positive().required().messages({
    'number.base': '会议室ID必须是数字',
    'any.required': '会议室ID是必填项'
  }),
  userId: Joi.number().integer().positive().required().messages({
    'number.base': '用户ID必须是数字',
    'any.required': '用户ID是必填项'
  }),
  startTime: Joi.date().required().messages({
    'date.base': '开始时间必须是有效日期',
    'any.required': '开始时间是必填项'
  }),
  endTime: Joi.date().required().greater(Joi.ref('startTime')).messages({
    'date.base': '结束时间必须是有效日期',
    'date.greater': '结束时间必须晚于开始时间',
    'any.required': '结束时间是必填项'
  }),
  releaseReason: Joi.string().valid(...Object.values(CompensationRecord.RELEASE_REASONS)).optional().messages({
    'any.only': '释放原因必须是有效选项'
  }),
  affectedEquipment: Joi.array().items(Joi.string()).optional().messages({
    'array.base': '受影响设备必须是数组'
  }),
  chargedAmount: Joi.number().precision(2).min(0).optional().messages({
    'number.base': '扣费金额必须是数字',
    'number.min': '扣费金额不能为负数'
  })
});

async function validateRecord(data, existingId = null) {
  const errors = [];
  
  const { error, value } = validationSchema.validate(data, { abortEarly: false });
  if (error) {
    error.details.forEach(detail => {
      errors.push({
        field: detail.path[0],
        message: detail.message,
        type: 'schema'
      });
    });
  }

  if (data.reservationId) {
    const duplicate = await CompensationRecord.findOne({
      where: {
        reservationId: data.reservationId,
        ...(existingId && { id: { [require('sequelize').Op.ne]: existingId } })
      }
    });
    if (duplicate) {
      errors.push({
        field: 'reservationId',
        message: `预约ID "${data.reservationId}" 已存在`,
        type: 'duplicate'
      });
    }
  }

  if (data.roomId) {
    const room = await Room.findByPk(data.roomId);
    if (!room) {
      errors.push({
        field: 'roomId',
        message: `会议室ID "${data.roomId}" 不存在`,
        type: 'not_found'
      });
    } else if (!room.isActive) {
      errors.push({
        field: 'roomId',
        message: `会议室 "${room.name}" 已停用`,
        type: 'inactive'
      });
    }
  }

  if (data.userId) {
    const user = await User.findByPk(data.userId);
    if (!user) {
      errors.push({
        field: 'userId',
        message: `用户ID "${data.userId}" 不存在`,
        type: 'not_found'
      });
    } else if (!user.isActive) {
      errors.push({
        field: 'userId',
        message: `用户 "${user.name}" 已停用`,
        type: 'inactive'
      });
    }
  }

  if (data.startTime && data.endTime) {
    const duration = moment(data.endTime).diff(moment(data.startTime), 'minutes');
    if (duration < 15) {
      errors.push({
        field: 'endTime',
        message: '预约时长不能少于15分钟',
        type: 'duration'
      });
    }
    if (duration > 480) {
      errors.push({
        field: 'endTime',
        message: '预约时长不能超过8小时',
        type: 'duration'
      });
    }
  }

  if (data.startTime) {
    if (moment(data.startTime).isBefore(moment())) {
      errors.push({
        field: 'startTime',
        message: '不能预约过去的时间',
        type: 'past_time'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    validatedData: value
  };
}

function validateCompensationRules(record) {
  const errors = [];
  const explanation = [];

  if (record.releaseReason === CompensationRecord.RELEASE_REASONS.EQUIPMENT_FAILURE) {
    if (!record.affectedEquipment || record.affectedEquipment.length === 0) {
      errors.push({
        rule: 'equipment_failure_details',
        message: '设备故障必须指定受影响的设备'
      });
    }

    if (parseFloat(record.chargedAmount) > 0) {
      explanation.push('设备故障导致会议室无法使用，但系统仍自动扣费，需人工核实后进行补偿');
      explanation.push(`扣费金额: ¥${record.chargedAmount}`);
      if (record.affectedEquipment && record.affectedEquipment.length > 0) {
        explanation.push(`受影响设备: ${record.affectedEquipment.join(', ')}`);
      }
    }
  }

  if (record.releaseReason === CompensationRecord.RELEASE_REASONS.DOUBLE_BOOKING) {
    explanation.push('检测到重复预订冲突，系统自动释放并标记为待处理');
  }

  if (parseFloat(record.chargedAmount) > 0 && record.status === CompensationRecord.STATUS.RELEASED) {
    errors.push({
      rule: 'charged_but_released',
      message: '会议室已释放但仍有扣费记录，需确认是否补偿'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    explanation: explanation.join('\n'),
    needsManual: errors.length > 0 || record.releaseReason === CompensationRecord.RELEASE_REASONS.EQUIPMENT_FAILURE
  };
}

function validateImportRow(row, rowNumber) {
  const errors = [];
  const requiredFields = ['reservationId', 'roomId', 'userId', 'startTime', 'endTime'];
  
  requiredFields.forEach(field => {
    if (!row[field] || String(row[field]).trim() === '') {
      errors.push({
        row: rowNumber,
        field,
        message: `${field} 不能为空`
      });
    }
  });

  if (row.startTime && row.endTime) {
    if (isNaN(Date.parse(row.startTime))) {
      errors.push({
        row: rowNumber,
        field: 'startTime',
        message: '开始时间格式无效'
      });
    }
    if (isNaN(Date.parse(row.endTime))) {
      errors.push({
        row: rowNumber,
        field: 'endTime',
        message: '结束时间格式无效'
      });
    }
  }

  if (row.roomId && isNaN(parseInt(row.roomId))) {
    errors.push({
      row: rowNumber,
      field: 'roomId',
      message: '会议室ID必须是数字'
    });
  }

  if (row.userId && isNaN(parseInt(row.userId))) {
    errors.push({
      row: rowNumber,
      field: 'userId',
      message: '用户ID必须是数字'
    });
  }

  if (row.chargedAmount && (isNaN(parseFloat(row.chargedAmount)) || parseFloat(row.chargedAmount) < 0)) {
    errors.push({
      row: rowNumber,
      field: 'chargedAmount',
      message: '扣费金额必须是非负数字'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateRecord,
  validateCompensationRules,
  validateImportRow
};

import Joi from 'joi';

export const roomStateSchema = Joi.object({
  roomNumber: Joi.string()
    .pattern(/^[A-Z]?\d{1,3}$/)
    .required()
    .messages({
      'string.pattern.base': '房间号格式不正确，应为字母+数字(如A101或101)',
      'any.required': '房间号不能为空'
    }),
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': '日期格式应为YYYY-MM-DD',
      'any.required': '日期不能为空'
    }),
  status: Joi.string()
    .valid('occupied', 'vacant', 'reserved', 'maintenance')
    .required()
    .messages({
      'any.only': '状态必须是: occupied, vacant, reserved, maintenance',
      'any.required': '状态不能为空'
    }),
  guestName: Joi.string().allow(null, '').optional(),
  guestPhone: Joi.string()
    .pattern(/^1[3-9]\d{9}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': '手机号格式不正确'
    }),
  checkInDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': '入住日期格式应为YYYY-MM-DD'
    }),
  checkOutDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': '离店日期格式应为YYYY-MM-DD'
    }),
  source: Joi.string().allow(null, '').optional()
});

export const cleaningRecordSchema = Joi.object({
  roomNumber: Joi.string()
    .pattern(/^[A-Z]?\d{1,3}$/)
    .required()
    .messages({
      'string.pattern.base': '房间号格式不正确',
      'any.required': '房间号不能为空'
    }),
  cleanerName: Joi.string().required().messages({
    'any.required': '保洁员姓名不能为空'
  }),
  cleanerPhone: Joi.string()
    .pattern(/^1[3-9]\d{9}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': '保洁员手机号格式不正确'
    }),
  scheduledDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': '计划日期格式应为YYYY-MM-DD',
      'any.required': '计划日期不能为空'
    }),
  startTime: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': '开始时间格式应为HH:MM'
    }),
  endTime: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': '结束时间格式应为HH:MM'
    }),
  status: Joi.string()
    .valid('pending', 'in_progress', 'completed', 'needs_rework', 'closed')
    .default('pending'),
  photos: Joi.array().items(Joi.string()).optional(),
  qualityScore: Joi.number().integer().min(0).max(100).optional(),
  remarks: Joi.string().allow(null, '').optional(),
  createdBy: Joi.string().allow(null, '').optional()
});

export const photoRecordSchema = Joi.object({
  cleaningId: Joi.number().integer().optional(),
  roomNumber: Joi.string()
    .pattern(/^[A-Z]?\d{1,3}$/)
    .required()
    .messages({
      'string.pattern.base': '房间号格式不正确',
      'any.required': '房间号不能为空'
    }),
  fileName: Joi.string().required().messages({
    'any.required': '文件名不能为空'
  }),
  photoDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': '照片日期格式应为YYYY-MM-DD',
      'any.required': '照片日期不能为空'
    }),
  uploader: Joi.string().optional()
});

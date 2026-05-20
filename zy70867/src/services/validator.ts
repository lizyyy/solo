import Joi from 'joi';
import {
  ReconciliationSubmitRequest,
  ErrorDetail,
  ProcessingStatus,
  LinenType,
  RoomType
} from '../types';

export enum ErrorCode {
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_DATE = 'INVALID_DATE',
  DATE_CONFLICT = 'DATE_CONFLICT',
  DUPLICATE_BATCH = 'DUPLICATE_BATCH',
  INVALID_QUANTITY = 'INVALID_QUANTITY',
  NEGATIVE_VALUE = 'NEGATIVE_VALUE'
}

const linenTypeValues = Object.values(LinenType);
const roomTypeValues = Object.values(RoomType);

const linenItemSchema = Joi.object({
  linenType: Joi.string().valid(...linenTypeValues).required().messages({
    'any.required': '布草类型不能为空',
    'any.only': `布草类型必须是以下值之一: ${linenTypeValues.join(', ')}`
  }),
  sendQuantity: Joi.number().integer().min(0).required().messages({
    'any.required': '送洗数量不能为空',
    'number.base': '送洗数量必须是数字',
    'number.integer': '送洗数量必须是整数',
    'number.min': '送洗数量不能为负数'
  }),
  returnQuantity: Joi.number().integer().min(0).required().messages({
    'any.required': '回收数量不能为空',
    'number.base': '回收数量必须是数字',
    'number.integer': '回收数量必须是整数',
    'number.min': '回收数量不能为负数'
  }),
  damagedQuantity: Joi.number().integer().min(0).required().messages({
    'any.required': '破损数量不能为空',
    'number.base': '破损数量必须是数字',
    'number.integer': '破损数量必须是整数',
    'number.min': '破损数量不能为负数'
  }),
  damageCompensation: Joi.number().min(0).required().messages({
    'any.required': '破损赔付不能为空',
    'number.base': '破损赔付必须是数字',
    'number.min': '破损赔付不能为负数'
  })
});

const roomStandardSchema = Joi.object({
  roomType: Joi.string().valid(...roomTypeValues).required().messages({
    'any.required': '房型不能为空',
    'any.only': `房型必须是以下值之一: ${roomTypeValues.join(', ')}`
  }),
  roomCount: Joi.number().integer().min(1).required().messages({
    'any.required': '房间数量不能为空',
    'number.base': '房间数量必须是数字',
    'number.integer': '房间数量必须是整数',
    'number.min': '房间数量至少为1'
  }),
  linenItems: Joi.array().items(linenItemSchema).min(1).required().messages({
    'any.required': '布草明细不能为空',
    'array.min': '布草明细至少需要一项'
  })
});

const billingItemSchema = Joi.object({
  linenType: Joi.string().valid(...linenTypeValues).required().messages({
    'any.required': '账单布草类型不能为空',
    'any.only': `账单布草类型必须是以下值之一: ${linenTypeValues.join(', ')}`
  }),
  billedQuantity: Joi.number().integer().min(0).required().messages({
    'any.required': '账单数量不能为空',
    'number.base': '账单数量必须是数字',
    'number.integer': '账单数量必须是整数',
    'number.min': '账单数量不能为负数'
  }),
  billedAmount: Joi.number().min(0).required().messages({
    'any.required': '账单金额不能为空',
    'number.base': '账单金额必须是数字',
    'number.min': '账单金额不能为负数'
  })
});

const requestSchema = Joi.object({
  batchId: Joi.string().required().messages({
    'any.required': '批次号不能为空'
  }),
  hotelId: Joi.string().required().messages({
    'any.required': '酒店ID不能为空'
  }),
  hotelName: Joi.string().required().messages({
    'any.required': '酒店名称不能为空'
  }),
  submitDate: Joi.string().isoDate().required().messages({
    'any.required': '提交日期不能为空',
    'string.isoDate': '提交日期格式不正确，应为ISO格式'
  }),
  washDate: Joi.string().isoDate().required().messages({
    'any.required': '洗涤日期不能为空',
    'string.isoDate': '洗涤日期格式不正确，应为ISO格式'
  }),
  returnDate: Joi.string().isoDate().required().messages({
    'any.required': '回收日期不能为空',
    'string.isoDate': '回收日期格式不正确，应为ISO格式'
  }),
  handler: Joi.string().required().messages({
    'any.required': '处理人不能为空'
  }),
  roomStandards: Joi.array().items(roomStandardSchema).min(1).required().messages({
    'any.required': '房型标准不能为空',
    'array.min': '房型标准至少需要一项'
  }),
  billingItems: Joi.array().items(billingItemSchema).min(1).required().messages({
    'any.required': '账单明细不能为空',
    'array.min': '账单明细至少需要一项'
  })
});

export function validateRequest(data: ReconciliationSubmitRequest): {
  isValid: boolean;
  errors: ErrorDetail[];
  processingStatus: ProcessingStatus;
  statusReason: string;
} {
  const errors: ErrorDetail[] = [];
  const { error } = requestSchema.validate(data, { abortEarly: false });

  if (error) {
    error.details.forEach((detail) => {
      const field = detail.path.join('.');
      const rowIndex = extractRowIndex(detail.path);
      
      errors.push({
        field,
        rowIndex,
        message: detail.message,
        errorCode: mapToErrorCode(detail.type)
      });
    });
  }

  const dateErrors = validateDateLogic(data);
  errors.push(...dateErrors);

  const quantityErrors = validateQuantityLogic(data);
  errors.push(...quantityErrors);

  let processingStatus: ProcessingStatus;
  let statusReason: string;

  const blockedErrors = errors.filter(e => 
    e.errorCode === ErrorCode.DATE_CONFLICT || 
    e.errorCode === ErrorCode.DUPLICATE_BATCH
  );

  if (blockedErrors.length > 0) {
    processingStatus = ProcessingStatus.BLOCKED;
    statusReason = '存在严重数据冲突，已拦截';
  } else if (errors.length > 0) {
    processingStatus = ProcessingStatus.PENDING_SUPPLEMENT;
    statusReason = `存在${errors.length}个数据问题，待补充完善`;
  } else {
    processingStatus = ProcessingStatus.NORMAL;
    statusReason = '数据校验通过，正常处理';
  }

  return {
    isValid: errors.length === 0,
    errors,
    processingStatus,
    statusReason
  };
}

function extractRowIndex(path: Array<string | number>): number | undefined {
  for (const item of path) {
    if (typeof item === 'number') {
      return item;
    }
  }
  return undefined;
}

function mapToErrorCode(joiType: string): ErrorCode {
  if (joiType === 'any.required' || joiType === 'array.min') {
    return ErrorCode.MISSING_FIELD;
  }
  if (joiType === 'string.isoDate') {
    return ErrorCode.INVALID_DATE;
  }
  if (joiType === 'number.min') {
    return ErrorCode.NEGATIVE_VALUE;
  }
  return ErrorCode.INVALID_TYPE;
}

function validateDateLogic(data: ReconciliationSubmitRequest): ErrorDetail[] {
  const errors: ErrorDetail[] = [];
  const submitDate = new Date(data.submitDate);
  const washDate = new Date(data.washDate);
  const returnDate = new Date(data.returnDate);

  if (washDate > submitDate) {
    errors.push({
      field: 'washDate',
      message: '洗涤日期不能晚于提交日期',
      errorCode: ErrorCode.DATE_CONFLICT
    });
  }

  if (returnDate < washDate) {
    errors.push({
      field: 'returnDate',
      message: '回收日期不能早于洗涤日期',
      errorCode: ErrorCode.DATE_CONFLICT
    });
  }

  return errors;
}

function validateQuantityLogic(data: ReconciliationSubmitRequest): ErrorDetail[] {
  const errors: ErrorDetail[] = [];

  data.roomStandards.forEach((roomStandard, roomIndex) => {
    roomStandard.linenItems.forEach((item, itemIndex) => {
      const totalExpected = item.sendQuantity;
      const totalActual = item.returnQuantity + item.damagedQuantity;
      
      if (totalActual > totalExpected) {
        errors.push({
          field: `roomStandards[${roomIndex}].linenItems[${itemIndex}]`,
          rowIndex: roomIndex,
          message: `${item.linenType}: 回收数量(${item.returnQuantity}) + 破损数量(${item.damagedQuantity}) = ${totalActual}，超过送洗数量(${totalExpected})`,
          errorCode: ErrorCode.INVALID_QUANTITY
        });
      }
    });
  });

  return errors;
}

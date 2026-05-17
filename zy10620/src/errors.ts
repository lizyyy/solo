import { ApiError, ErrorCategory } from './types';

export function createApiError(
  code: string,
  message: string,
  category: ErrorCategory,
  suggestion: string,
  details: Record<string, any> = {}
): ApiError {
  return {
    code,
    message,
    category,
    suggestion,
    details,
    timestamp: new Date().toISOString()
  };
}

export const errors = {
  leaseNotFound: (id: string) => createApiError(
    'LEASE_NOT_FOUND',
    `租赁记录 ${id} 不存在`,
    'data_integrity',
    '请检查租赁记录ID是否正确',
    { leaseId: id }
  ),

  invalidStatusTransition: (from: string, to: string) => createApiError(
    'INVALID_STATUS_TRANSITION',
    `无法从 ${from} 状态转换到 ${to} 状态`,
    'business_rule',
    '请按照正确的流程进行状态转换',
    { fromStatus: from, toStatus: to }
  ),

  conflictNotFound: (conflictId: string) => createApiError(
    'CONFLICT_NOT_FOUND',
    `冲突记录 ${conflictId} 不存在`,
    'data_integrity',
    '请检查冲突记录ID是否正确',
    { conflictId }
  ),

  paymentRequired: () => createApiError(
    'PAYMENT_REQUIRED',
    '请先完成付款后再续租',
    'business_rule',
    '请确认付款状态后重试',
    {}
  ),

  remarkRequired: () => createApiError(
    'REMARK_REQUIRED',
    '人工处理冲突需要添加备注说明',
    'human_intervention',
    '请添加处理备注后重试',
    {}
  ),

  importBadData: (rowNumber: number) => createApiError(
    'IMPORT_BAD_DATA',
    `第 ${rowNumber} 行数据格式错误`,
    'data_integrity',
    '请修正导入数据后重试',
    { rowNumber }
  ),

  conflictNotResolved: (conflictCount: number) => createApiError(
    'CONFLICT_NOT_RESOLVED',
    `还有 ${conflictCount} 个续租冲突未解决`,
    'business_rule',
    '请先解决所有冲突后再确认续租',
    { unresolvedCount: conflictCount }
  ),

  missingRequiredField: (fieldName: string) => createApiError(
    'MISSING_REQUIRED_FIELD',
    `缺少必填字段: ${fieldName}`,
    'data_integrity',
    `请补充 ${fieldName} 字段后重试`,
    { missingField: fieldName }
  ),

  renewalConflictDetected: () => createApiError(
    'RENEWAL_CONFLICT_DETECTED',
    '检测到续租冲突，需要人工处理',
    'human_intervention',
    '请查看冲突详情并添加备注后继续处理',
    {}
  ),

  duplicateRenewal: () => createApiError(
    'DUPLICATE_RENEWAL',
    '该租约已有续租记录，请勿重复提交',
    'business_rule',
    '请检查现有续租记录后重试',
    {}
  )
};

export function getHttpStatus(category: ErrorCategory): number {
  const statusMap: Record<ErrorCategory, number> = {
    'data_integrity': 400,
    'business_rule': 422,
    'human_intervention': 409,
    'system_error': 500
  };
  return statusMap[category] || 500;
}

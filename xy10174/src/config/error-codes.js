module.exports = {
  SUCCESS: { code: 0, message: '成功' },

  BUDGET_NOT_FOUND: { code: 1001, message: '预算不存在' },
  BUDGET_EXPIRED: { code: 1002, message: '预算已过期' },
  BUDGET_INSUFFICIENT: { code: 1003, message: '预算余额不足' },
  BUDGET_DISABLED: { code: 1004, message: '预算已禁用' },

  LOCK_NOT_FOUND: { code: 2001, message: '预算锁定不存在' },
  LOCK_ALREADY_EXISTS: { code: 2002, message: '该申请已存在预算锁定' },
  LOCK_EXPIRED: { code: 2003, message: '预算锁定已过期' },
  LOCK_ALREADY_RELEASED: { code: 2004, message: '预算锁定已被释放' },
  LOCK_ALREADY_COMMITTED: { code: 2005, message: '预算锁定已被提交' },

  APPROVAL_NOT_FOUND: { code: 3001, message: '审批记录不存在' },
  APPROVAL_ALREADY_COMPLETED: { code: 3002, message: '审批已完成' },
  APPROVAL_INVALID_STATUS: { code: 3003, message: '无效的审批状态' },
  APPROVAL_CONFLICT: { code: 3004, message: '审批状态冲突，请刷新重试' },

  CONCURRENT_CONFLICT: { code: 4001, message: '并发冲突，请重试' },
  DEADLOCK_DETECTED: { code: 4002, message: '检测到死锁，请重试' },

  DEPARTMENT_NOT_FOUND: { code: 5001, message: '部门不存在' },

  VALIDATION_ERROR: { code: 9001, message: '参数校验失败' },
  INTERNAL_ERROR: { code: 9999, message: '服务器内部错误' }
};

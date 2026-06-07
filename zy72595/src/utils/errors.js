const ERROR_MESSAGES = {
  BATCH_ALREADY_IMPORTED: {
    code: 'BATCH_ALREADY_IMPORTED',
    message: '该批次阈值调参笔记已经导入过了，系统不会重复计数，请检查批次号是否正确',
    suggestion: '如果确实需要重新导入，请先删除原有评测或使用新的批次号'
  },
  EVAL_NOT_FOUND: {
    code: 'EVAL_NOT_FOUND',
    message: '找不到对应的小样本评测记录',
    suggestion: '请检查评测ID是否正确，或先创建评测'
  },
  NOTE_NOT_FOUND: {
    code: 'NOTE_NOT_FOUND',
    message: '找不到对应的阈值调参笔记',
    suggestion: '请确认笔记是否已正确导入'
  },
  INVALID_WORKFLOW_ORDER: {
    code: 'INVALID_WORKFLOW_ORDER',
    message: '工作流步骤顺序不对，不能跳过步骤直接推进',
    suggestion: '请按照"导入→补看线上实验桶→实验对比更新"的顺序操作'
  },
  INVALID_BUCKET_NAME: {
    code: 'INVALID_BUCKET_NAME',
    message: '桶名称不正确',
    suggestion: '桶名称只能是：差、较差、一般、良好、优秀'
  },
  INVALID_DISPLAY_MODE: {
    code: 'INVALID_DISPLAY_MODE',
    message: '不支持的展示模式',
    suggestion: '请选择表格(table)、图表(chart)或3D(3d)模式'
  },
  EMPTY_BATCH_ID: {
    code: 'EMPTY_BATCH_ID',
    message: '批次号不能为空',
    suggestion: '请输入有效的批次号再导入'
  },
  NO_PERMISSION: {
    code: 'NO_PERMISSION',
    message: '您没有权限执行此操作',
    suggestion: '请联系管理员开通相应权限'
  },
  ONE_BUCKET_DIFF_NEEDS_REVIEW: {
    code: 'ONE_BUCKET_DIFF_NEEDS_REVIEW',
    message: '存在离线和线上分数差一个桶的记录，需要评测运营复核',
    suggestion: '请不要急着归为正常，先通知评测运营进行人工复核'
  },
  ROLLBACK_STEP_INVALID: {
    code: 'ROLLBACK_STEP_INVALID',
    message: '回滚的目标步骤不合法',
    suggestion: '只能回滚到之前经历过的步骤'
  },
  REMARK_SAME_AS_BEFORE: {
    code: 'REMARK_SAME_AS_BEFORE',
    message: '备注内容和之前一样，没有修改',
    suggestion: '如果需要记录修改，请修改备注内容后再保存'
  }
};

class FriendlyError extends Error {
  constructor(errorKey, details = {}) {
    const errorInfo = ERROR_MESSAGES[errorKey] || {
      code: 'UNKNOWN_ERROR',
      message: '发生了未知错误',
      suggestion: '请联系技术支持'
    };
    super(errorInfo.message);
    this.name = 'FriendlyError';
    this.code = errorInfo.code;
    this.userMessage = errorInfo.message;
    this.suggestion = errorInfo.suggestion;
    this.details = details;
  }

  toDisplay() {
    return {
      error: true,
      code: this.code,
      message: this.userMessage,
      suggestion: this.suggestion,
      details: this.details
    };
  }
}

function wrapError(error) {
  if (error instanceof FriendlyError) {
    return error.toDisplay();
  }
  if (error.message) {
    const matchedKey = Object.keys(ERROR_MESSAGES).find(key => error.message.includes(key));
    if (matchedKey) {
      return new FriendlyError(matchedKey).toDisplay();
    }
  }
  return {
    error: true,
    code: 'SYSTEM_ERROR',
    message: '系统出了点小问题，请稍后再试',
    suggestion: '如果问题持续存在，请联系技术支持',
    rawError: error.message
  };
}

module.exports = {
  FriendlyError,
  ERROR_MESSAGES,
  wrapError
};

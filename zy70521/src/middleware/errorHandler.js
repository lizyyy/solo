const ERROR_MESSAGES = {
  DELETION_REQUEST_NOT_FOUND: {
    code: 'NOT_FOUND',
    message: '删除请求不存在',
    details: '请检查请求ID是否正确'
  },
  INVALID_STATUS_TRANSITION: {
    code: 'INVALID_TRANSITION',
    message: '无效的状态转换',
    details: '当前状态不允许转换到目标状态，请参考状态流转图'
  },
  REVOCATION_NOT_ALLOWED: {
    code: 'REVOCATION_DENIED',
    message: '撤销申请不被允许',
    details: '仅在宽限期内且处于IN_GRACE_PERIOD状态时可以申请撤销'
  },
  PURGE_NOT_ALLOWED: {
    code: 'PURGE_DENIED',
    message: '创建清除任务不被允许',
    details: '仅IN_GRACE_PERIOD或PURGE_SCHEDULED状态可以创建清除任务'
  },
  PURGE_ALREADY_COMPLETED: {
    code: 'PURGE_IDEMPOTENT',
    message: '清除任务已完成',
    details: '幂等性保护：同一删除请求只能完成一次清除'
  },
  REVOCATION_NOT_FOUND: {
    code: 'NOT_FOUND',
    message: '撤销请求不存在',
    details: '请检查撤销请求ID是否正确'
  },
  REVOCATION_ALREADY_REVIEWED: {
    code: 'ALREADY_REVIEWED',
    message: '撤销请求已审核',
    details: '同一撤销请求只能审核一次'
  },
  PURGE_TASK_NOT_FOUND: {
    code: 'NOT_FOUND',
    message: '清除任务不存在',
    details: '请检查任务ID是否正确'
  },
  TASK_NOT_SCHEDULED: {
    code: 'INVALID_STATE',
    message: '任务未处于调度状态',
    details: '只能启动处于SCHEDULED状态的任务'
  },
  TASK_NOT_IN_PROGRESS: {
    code: 'INVALID_STATE',
    message: '任务未处于执行状态',
    details: '只能完成处于IN_PROGRESS状态的任务'
  },
  NO_VALID_FIELDS_TO_UPDATE: {
    code: 'VALIDATION_ERROR',
    message: '没有可更新的有效字段',
    details: '请检查提交的字段是否在允许更新的范围内'
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: '参数验证失败',
    details: '请检查请求参数是否符合要求'
  }
};

function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);

  const errorKey = err.message.split(':')[0];
  const errorInfo = ERROR_MESSAGES[errorKey];

  if (errorInfo) {
    return res.status(400).json({
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
        details: errorInfo.details,
        raw_error: err.message
      },
      timestamp: new Date().toISOString(),
      path: req.path
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: '参数验证失败',
        details: err.details
      },
      timestamp: new Date().toISOString(),
      path: req.path
    });
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      details: '请联系技术支持'
    },
    timestamp: new Date().toISOString(),
    path: req.path
  });
}

module.exports = errorHandler;

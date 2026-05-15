function successResponse(data, message = '操作成功') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

function errorResponse(message = '操作失败', errors = null, code = 400) {
  return {
    success: false,
    message,
    errors,
    code,
    timestamp: new Date().toISOString()
  };
}

function batchOperationResponse(summary, details, message = '批量操作完成') {
  return {
    success: true,
    message,
    data: {
      summary,
      details
    },
    timestamp: new Date().toISOString()
  };
}

function candidateListResponse(candidates, metadata = {}) {
  return {
    success: true,
    message: '候选清单生成成功，请确认后执行操作',
    data: {
      candidates,
      metadata,
      totalCount: candidates.length,
      requiresConfirmation: true
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  successResponse,
  errorResponse,
  batchOperationResponse,
  candidateListResponse
};
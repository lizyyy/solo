class ResponseHandler {
  static success(res, data = {}, message = '操作成功', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created(res, data = {}, message = '创建成功') {
    return ResponseHandler.success(res, data, message, 201);
  }

  static error(res, error, message = '操作失败', statusCode = 400) {
    const errorDetails = {
      message: error.message || message,
      code: error.code || 'UNKNOWN_ERROR',
      details: error.details || null,
      suggestion: error.suggestion || null,
    };

    return res.status(statusCode).json({
      success: false,
      message: errorDetails.message,
      error: errorDetails,
    });
  }

  static notFound(res, message = '资源不存在') {
    return ResponseHandler.error(res, { message }, message, 404);
  }

  static forbidden(res, message = '没有权限执行此操作') {
    return ResponseHandler.error(res, { message }, message, 403);
  }

  static validationError(res, errors, message = '数据验证失败') {
    return ResponseHandler.error(
      res,
      { message, details: errors, suggestion: '请检查输入数据格式是否正确' },
      message,
      400
    );
  }

  static conflict(res, message = '操作冲突', suggestion = null) {
    return ResponseHandler.error(
      res,
      { message, suggestion },
      message,
      409
    );
  }

  static pagination(res, data, total, page = 1, pageSize = 10, message = '获取成功') {
    const totalPages = Math.ceil(total / pageSize);
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  }
}

module.exports = ResponseHandler;

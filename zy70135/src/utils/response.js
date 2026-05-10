class ResponseUtils {
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  static created(res, data = null, message = 'Created successfully') {
    return ResponseUtils.success(res, data, message, 201);
  }

  static noContent(res) {
    return res.status(204).send();
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data: data.items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page * pagination.limit < pagination.total,
        hasPrev: pagination.page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  }

  static error(res, error) {
    const statusCode = error.statusCode || 500;
    const code = error.code || 'INTERNAL_ERROR';
    const message = error.isOperational ? error.message : 'Internal server error';

    const response = {
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    };

    if (error.errors) {
      response.error.details = error.errors;
    }

    return res.status(statusCode).json(response);
  }

  static notFound(res, message = 'Resource not found') {
    return ResponseUtils.error(res, {
      statusCode: 404,
      code: 'NOT_FOUND',
      message,
      isOperational: true,
    });
  }

  static badRequest(res, message = 'Bad request', errors = []) {
    return ResponseUtils.error(res, {
      statusCode: 400,
      code: 'BAD_REQUEST',
      message,
      errors,
      isOperational: true,
    });
  }

  static unauthorized(res, message = 'Unauthorized') {
    return ResponseUtils.error(res, {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message,
      isOperational: true,
    });
  }

  static forbidden(res, message = 'Forbidden') {
    return ResponseUtils.error(res, {
      statusCode: 403,
      code: 'FORBIDDEN',
      message,
      isOperational: true,
    });
  }
}

module.exports = ResponseUtils;

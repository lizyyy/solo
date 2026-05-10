class ResponseUtils {
  static success(res, data, message = '操作成功') {
    return res.status(200).json({
      success: true,
      message,
      data
    });
  }

  static error(res, message, statusCode = 500, data = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      data
    });
  }

  static badRequest(res, message, data = null) {
    return this.error(res, message, 400, data);
  }

  static notFound(res, message = '资源不存在') {
    return this.error(res, message, 404);
  }

  static unauthorized(res, message = '未授权访问') {
    return this.error(res, message, 401);
  }
}

module.exports = ResponseUtils;

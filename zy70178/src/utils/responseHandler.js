class ResponseHandler {
  static success(res, data, message = '操作成功') {
    res.status(200).json({
      success: true,
      message: message,
      data: data,
      timestamp: new Date().toISOString()
    });
  }

  static created(res, data, message = '创建成功') {
    res.status(201).json({
      success: true,
      message: message,
      data: data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, error, statusCode = 400) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: {
        type: error.name || 'Error',
        details: errorMessage
      },
      timestamp: new Date().toISOString()
    });
  }

  static notFound(res, resource = '资源') {
    res.status(404).json({
      success: false,
      message: `${resource}不存在`,
      timestamp: new Date().toISOString()
    });
  }

  static businessResult(res, data, businessMessage) {
    res.status(200).json({
      success: true,
      businessMessage: businessMessage,
      data: data,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = ResponseHandler;

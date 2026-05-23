const { v4: uuidv4 } = require('uuid');

class ResponseUtil {
  static success(res, data, message = '操作成功', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      status: 'completed',
      message,
      data
    });
  }

  static pendingReview(res, data, message = '待复核') {
    return res.status(202).json({
      success: true,
      status: 'pending_review',
      message,
      data
    });
  }

  static rejected(res, data, message = '已驳回') {
    return res.status(403).json({
      success: false,
      status: 'rejected',
      message,
      data
    });
  }

  static compensated(res, data, message = '已补偿') {
    return res.status(200).json({
      success: true,
      status: 'compensated',
      message,
      data
    });
  }

  static notFound(res, message = '资源不存在') {
    return res.status(404).json({
      success: false,
      status: 'not_found',
      message,
      data: null
    });
  }

  static invalidInput(res, message = '输入参数无效', errors = null) {
    return res.status(400).json({
      success: false,
      status: 'invalid_input',
      message,
      errors,
      data: null
    });
  }

  static conflict(res, message = '资源冲突', data = null) {
    return res.status(409).json({
      success: false,
      status: 'conflict',
      message,
      data
    });
  }

  static withRequestId(req, res) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', requestId);
    return requestId;
  }
}

module.exports = ResponseUtil;

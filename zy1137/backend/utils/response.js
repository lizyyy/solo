const sendResponse = (res, statusCode, data = null, message = '操作成功') => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

const sendSuccess = (res, data = null, message = '操作成功') => {
  return sendResponse(res, 200, data, message);
};

const sendCreated = (res, data = null, message = '创建成功') => {
  return sendResponse(res, 201, data, message);
};

const sendNoContent = (res) => {
  return res.status(204).send();
};

const sendPaginated = (res, items, page, pageSize, total, message = '获取成功') => {
  const totalPages = Math.ceil(total / pageSize);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return sendSuccess(res, {
    items,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages,
      hasNext,
      hasPrev
    }
  }, message);
};

const sendError = (res, statusCode, message, code = 'ERROR', errors = null) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      errors
    },
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  sendResponse,
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
  sendError
};

const successResponse = (res, data, message = '操作成功', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message
  });
};

const createdResponse = (res, data, message = '创建成功') => {
  return successResponse(res, data, message, 201);
};

const noContentResponse = (res, message = '操作成功') => {
  return res.status(204).json({
    success: true,
    message
  });
};

const paginatedResponse = (res, data, pagination, message = '获取成功') => {
  return res.status(200).json({
    success: true,
    data,
    pagination,
    message
  });
};

module.exports = {
  successResponse,
  createdResponse,
  noContentResponse,
  paginatedResponse
};

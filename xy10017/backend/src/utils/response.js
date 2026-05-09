function success(data, message = 'Success') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

function error(message = 'Error', statusCode = 500, data = null) {
  return {
    success: false,
    message,
    statusCode,
    data,
    timestamp: new Date().toISOString(),
  };
}

function pagination(data, total, page, limit) {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  success,
  error,
  pagination,
};

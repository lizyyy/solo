const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: '验证失败',
      details: err.details
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      success: false,
      error: '数据冲突',
      message: '唯一约束违反，可能是重复请求'
    });
  }

  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
};

module.exports = errorHandler;

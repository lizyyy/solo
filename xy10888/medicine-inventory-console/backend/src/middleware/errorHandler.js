const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: '参数验证失败',
      details: err.details
    });
  }
  
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({
      success: false,
      error: '数据重复',
      message: '该记录已存在，请检查唯一约束'
    });
  }
  
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(400).json({
      success: false,
      error: '外键约束失败',
      message: '关联数据不存在'
    });
  }
  
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || '服务器内部错误',
    requestId: req.requestId
  });
};

module.exports = errorHandler;

const errorHandler = (err, req, res, next) => {
  console.error('错误:', err);
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = { errorHandler };

const { ExceptionLogDAO } = require('../database/dao');

const exceptionLogDAO = new ExceptionLogDAO();

const generateExceptionCode = () => {
  return `EXC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

const exceptionHandler = async (err, req, res, next) => {
  console.error('异常捕获:', err);

  const exceptionCode = generateExceptionCode();
  
  try {
    await exceptionLogDAO.create({
      exception_code: exceptionCode,
      api_endpoint: `${req.method} ${req.path}`,
      original_input: JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params
      }),
      error_message: err.message || String(err),
      processing_conclusion: 'system_error',
      status: 'pending'
    });
  } catch (logErr) {
    console.error('记录异常日志失败:', logErr);
  }

  res.status(500).json({
    success: false,
    status: 'system_error',
    exception_code: exceptionCode,
    message: '服务器内部错误，请联系管理员',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

const logException = async (req, error, conclusion = 'pending') => {
  const exceptionCode = generateExceptionCode();
  try {
    await exceptionLogDAO.create({
      exception_code: exceptionCode,
      api_endpoint: `${req.method} ${req.path}`,
      original_input: JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params
      }),
      error_message: typeof error === 'string' ? error : error.message,
      processing_conclusion: conclusion,
      status: 'pending'
    });
    return exceptionCode;
  } catch (logErr) {
    console.error('记录异常日志失败:', logErr);
    return null;
  }
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    status: 'not_found',
    message: '请求的资源不存在'
  });
};

module.exports = { exceptionHandler, logException, notFoundHandler };

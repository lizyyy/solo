const ArticleService = require('../models/articleService');

function validateArticleData(data) {
  const errors = [];
  
  if (!data.article_no || typeof data.article_no !== 'string') {
    errors.push('article_no 是必填字符串字段');
  }
  if (!data.title || typeof data.title !== 'string') {
    errors.push('title 是必填字符串字段');
  }
  if (!data.team || typeof data.team !== 'string') {
    errors.push('team 是必填字符串字段');
  }
  if (!data.valid_until) {
    errors.push('valid_until 是必填字段');
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.valid_until)) {
      errors.push('valid_until 格式必须为 YYYY-MM-DD');
    } else {
      const date = new Date(data.valid_until);
      if (isNaN(date.getTime())) {
        errors.push('valid_until 不是有效日期');
      }
    }
  }

  return errors;
}

async function errorHandler(err, req, res, next) {
  console.error('错误:', err);

  const originalInput = {
    body: req.body,
    params: req.params,
    query: req.query
  };

  await ArticleService.logException(
    req.path,
    originalInput,
    err.message,
    err.stack || '未知处理依据'
  );

  res.status(500).json({
    error: '服务器内部错误',
    message: err.message,
    exception_logged: true
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  asyncHandler,
  validateArticleData
};

const responseHandler = (req, res, next) => {
  res.success = (data = null, message = '操作成功') => {
    res.json({
      code: 0,
      message,
      data
    });
  };

  res.error = (message = '操作失败', code = 1, data = null) => {
    res.json({
      code,
      message,
      data
    });
  };

  next();
};

module.exports = responseHandler;

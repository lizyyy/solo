function success(res, data, message = '操作成功') {
  res.json({ success: true, data, message });
}

function fail(res, error, code = 400, message = '操作失败') {
  res.status(code).json({ success: false, error, message });
}

function paginate(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  req.pagination = { page, limit, offset: (page - 1) * limit };
  next();
}

module.exports = { success, fail, paginate };

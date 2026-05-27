function jsonOk(res, data, meta = {}) {
  res.json({ code: 0, data, ...meta });
}

function jsonErr(res, message, status = 400, extra = {}) {
  res.status(status).json({ code: 1, error: message, ...extra });
}

module.exports = { jsonOk, jsonErr };

function extractOperator(req, res, next) {
  let operator = req.headers['x-operator'];
  
  if (operator) {
    if (typeof operator === 'string') {
      try {
        const buffer = Buffer.from(operator, 'latin1');
        const decoded = buffer.toString('utf8');
        if (/[\u4e00-\u9fa5]/.test(decoded)) {
          operator = decoded;
        }
      } catch (e) {
      }
    }
  }
  
  req.operator = operator || 'system';
  next();
}

module.exports = { extractOperator };

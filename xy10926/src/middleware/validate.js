const { logError } = require('./errorHandler');

function validateRequest(schema, req, res, next) {
  const { error, value } = schema.validate(req.body);
  if (error) {
    const validationError = new Error(`参数验证失败: ${error.details[0].message}`);
    validationError.statusCode = 400;
    
    logError(req.path, req.method, req.body, validationError);
    
    return res.status(400).json({ 
      success: false, 
      error: error.details[0].message,
      statusCode: 400
    });
  }
  req.validatedBody = value;
  return null;
}

module.exports = { validateRequest };

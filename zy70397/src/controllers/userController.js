const { adaptRequest } = require('../middleware/compatibility');
const { recordRequest } = require('../utils/storage');
const { cacheIdempotentResult } = require('../middleware/idempotency');

function updateUserProfile(req, res) {
  const clientVersion = req.headers['x-client-version'] || '1.0.0';
  const endpoint = req.path;
  
  const compatibilityResult = adaptRequest(req.body, clientVersion, endpoint);
  
  recordRequest(
    compatibilityResult.originalBody,
    compatibilityResult.adaptedBody,
    clientVersion,
    compatibilityResult.matchedRules,
    compatibilityResult.warnings,
    compatibilityResult.errors,
    endpoint
  );
  
  if (compatibilityResult.errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: '请求字段冲突或不符合要求',
      errorCode: 'FIELD_CONFLICT_OR_INVALID',
      compatibilityInfo: {
        adapted: false,
        originalBody: compatibilityResult.originalBody,
        adaptedBody: compatibilityResult.adaptedBody,
        matchedRules: compatibilityResult.matchedRules,
        riskLevel: compatibilityResult.riskLevel
      },
      errors: compatibilityResult.errors,
      warnings: compatibilityResult.warnings
    });
  }
  
  const adaptedBody = compatibilityResult.adaptedBody;
  
  const businessResult = {
    userId: 'user_' + Date.now(),
    username: adaptedBody.username,
    phone: adaptedBody.phone,
    age: adaptedBody.age,
    address: adaptedBody.address,
    deviceType: adaptedBody.deviceType,
    appSource: adaptedBody.appSource,
    isWebview: adaptedBody.isWebview,
    updatedAt: new Date().toISOString()
  };
  
  if (req.idempotencyKey) {
    cacheIdempotentResult(req.idempotencyKey, businessResult);
  }
  
  res.json({
    success: true,
    message: '用户资料更新成功',
    data: businessResult,
    compatibilityInfo: {
      adapted: compatibilityResult.matchedRules.length > 0,
      originalBody: compatibilityResult.originalBody,
      adaptedBody: compatibilityResult.adaptedBody,
      matchedRules: compatibilityResult.matchedRules,
      warnings: compatibilityResult.warnings,
      riskLevel: compatibilityResult.riskLevel
    }
  });
}

module.exports = {
  updateUserProfile
};

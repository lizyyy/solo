const { prepare, all } = require('../config/database');

function getDefaultConclusion(errorType, errorMessage) {
  const conclusions = {
    'ValidationError': '请求参数验证失败，已返回400错误告知客户端修正请求格式',
    'NotFound': '请求资源不存在，已返回404错误',
    'DuplicateReminder': '催取去重机制生效，重复请求已拦截，避免重复发送短信',
    'InvalidTransition': '状态流转不合法，已阻止状态变更，需检查当前状态是否允许目标操作',
    'DatabaseError': '数据库操作异常，已回滚事务，建议检查数据一致性',
    'BusinessError': '业务规则校验失败，操作已终止'
  };
  
  return conclusions[errorType] || `异常类型: ${errorType}，错误信息: ${errorMessage}，已记录并返回对应错误码，待人工跟进处理`;
}

async function logException(apiPath, method, rawInput, errorType, errorMessage, conclusion = null) {
  const processingConclusion = conclusion || getDefaultConclusion(errorType, errorMessage);
  
  const stmt = prepare(`
    INSERT INTO exception_logs 
    (api_path, request_method, raw_input, error_type, error_message, processing_conclusion)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  return await stmt.run(apiPath, method, JSON.stringify(rawInput), errorType, errorMessage, processingConclusion);
}

async function getExceptionLogs(limit = 50, offset = 0) {
  return await all(`
    SELECT * FROM exception_logs 
    ORDER BY occurred_at DESC 
    LIMIT ? OFFSET ?
  `, [limit, offset]);
}

async function resolveException(id, handledBy, conclusion) {
  const stmt = prepare(`
    UPDATE exception_logs 
    SET is_resolved = 1, handled_by = ?, processing_conclusion = ?
    WHERE id = ?
  `);
  
  return await stmt.run(handledBy, conclusion, id);
}

module.exports = {
  logException,
  getExceptionLogs,
  resolveException
};

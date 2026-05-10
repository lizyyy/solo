const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));

    throw new ValidationError('参数验证失败', formattedErrors);
  };
};

const validators = {
  login: validate([
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
  ]),

  createBlacklist: validate([
    body('memberIdentifier').notEmpty().withMessage('会员标识不能为空'),
    body('reason').optional().isLength({ max: 500 }).withMessage('原因不能超过500个字符'),
    body('sourceType')
      .isIn(['manual', 'api_import', 'batch_upload', 'risk_detection', 'legacy_sync'])
      .withMessage('无效的来源类型'),
    body('isShared').optional().isBoolean().withMessage('isShared 必须是布尔值'),
  ]),

  updateBlacklist: validate([
    param('id').isUUID().withMessage('无效的ID格式'),
    body('reason').optional().isLength({ max: 500 }).withMessage('原因不能超过500个字符'),
    body('isShared').optional().isBoolean().withMessage('isShared 必须是布尔值'),
  ]),

  manualCorrect: validate([
    param('id').isUUID().withMessage('无效的ID格式'),
    body('reason').notEmpty().withMessage('人工修正原因不能为空'),
    body('reason').isLength({ min: 10, max: 1000 }).withMessage('原因长度应在10-1000字符之间'),
  ]),

  checkMember: validate([
    query('memberIdentifier').notEmpty().withMessage('会员标识不能为空'),
    query('identifierType').optional().isIn(['phone', 'id_card', 'user_id']),
    query('context').optional().isString(),
  ]),

  createExemption: validate([
    body('blacklistId').isUUID().withMessage('无效的黑名单ID'),
    body('type').isIn(['temporary', 'permanent', 'emergency']).withMessage('无效的豁免类型'),
    body('durationDays')
      .optional()
      .isInt({ min: 1, max: 90 })
      .withMessage('豁免天数应在1-90天之间'),
    body('reason')
      .notEmpty()
      .withMessage('豁免原因不能为空')
      .isLength({ min: 10, max: 1000 })
      .withMessage('豁免原因应在10-1000字符之间'),
  ]),

  approveExemption: validate([
    param('id').isUUID().withMessage('无效的豁免ID'),
    body('comment').optional().isLength({ max: 1000 }).withMessage('审批备注不能超过1000字符'),
  ]),

  createShareVersion: validate([
    body('name').optional().isLength({ max: 200 }).withMessage('版本名称不能超过200字符'),
    body('description').optional().isLength({ max: 1000 }).withMessage('描述不能超过1000字符'),
  ]),

  publishShareVersion: validate([
    param('id').isUUID().withMessage('无效的版本ID'),
  ]),

  pagination: validate([
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须大于0'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('每页条数应在1-1000之间'),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ]),

  exportRequest: validate([
    body('type').isIn(['blacklist', 'hit_records', 'audit_logs', 'risk_report']).withMessage('无效的导出类型'),
    body('format').optional().isIn(['csv', 'json']).withMessage('无效的导出格式'),
    body('filters').optional().isObject(),
  ]),

  reportDateRange: validate([
    query('startDate').isISO8601().withMessage('开始时间格式无效'),
    query('endDate').isISO8601().withMessage('结束时间格式无效'),
    query('groupBy').optional().isIn(['day', 'month']),
  ]),
};

module.exports = { validate, validators };

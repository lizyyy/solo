const { ErrorCode } = require('../models/types');

class BusinessError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

const createBusinessError = {
  sceneLocked: (sceneName, locker) => 
    new BusinessError(
      ErrorCode.SCENE_LOCKED,
      `场景【${sceneName}】已被锁定，无法修改。`,
      {
        lockedBy: locker,
        suggestion: '请联系场景负责人解锁，或在解锁后重试。演出前冻结的场景需技术主管审批才能解锁。'
      }
    ),

  sceneNotFound: (sceneId) =>
    new BusinessError(
      ErrorCode.SCENE_NOT_FOUND,
      `场景ID【${sceneId}】不存在。`,
      {
        suggestion: '请检查场景ID是否正确，或联系技术人员确认场景是否已创建。'
      }
    ),

  presetNotFound: (presetId) =>
    new BusinessError(
      ErrorCode.PRESET_NOT_FOUND,
      `预设版本【${presetId}】不存在。`,
      {
        suggestion: '请检查预设ID是否正确，或在版本列表中确认该版本是否已被删除。'
      }
    ),

  presetAlreadyExists: (version, sceneName) =>
    new BusinessError(
      ErrorCode.PRESET_ALREADY_EXISTS,
      `场景【${sceneName}】中已存在版本号【${version}】。`,
      {
        suggestion: '版本号在同一场景下必须唯一，请使用新的版本号或修改现有版本。'
      }
    ),

  invalidPresetStatus: (currentStatus, allowedStatuses) =>
    new BusinessError(
      ErrorCode.INVALID_PRESET_STATUS,
      `预设当前状态【${currentStatus}】不允许执行此操作。`,
      {
        allowedStatuses,
        suggestion: `请将预设状态调整为以下之一后重试：${allowedStatuses.join('、')}`
      }
    ),

  invalidStateTransition: (from, to) =>
    new BusinessError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `状态流转无效：无法从【${from}】直接切换到【${to}】。`,
      {
        suggestion: '请按照正确的审批流程操作：草稿→待审批→已批准→冻结→激活'
      }
    ),

  approvalNotFound: (approvalId) =>
    new BusinessError(
      ErrorCode.APPROVAL_NOT_FOUND,
      `审批记录【${approvalId}】不存在。`,
      {
        suggestion: '请检查审批ID是否正确。'
      }
    ),

  missingRequiredFields: (missingFields) =>
    new BusinessError(
      ErrorCode.MISSING_REQUIRED_FIELDS,
      `缺少必要字段：${missingFields.join('、')}。`,
      {
        missingFields,
        suggestion: '请补充上述必填字段后重试。'
      }
    ),

  invalidLightPosition: (positionName, reason) =>
    new BusinessError(
      ErrorCode.INVALID_LIGHT_POSITION,
      `灯位【${positionName}】参数无效：${reason}。`,
      {
        positionName,
        reason,
        suggestion: '灯位参数需包含：intensity(0-100)、color(十六进制颜色值)、pan(-180~180)、tilt(-90~90)'
      }
    ),

  duplicateVersion: (version) =>
    new BusinessError(
      ErrorCode.DUPLICATE_VERSION,
      `版本号【${version}】重复。`,
      {
        version,
        suggestion: '请使用语义化版本号，如 v1.0.1、v2.0.0-beta 等。'
      }
    ),

  notAuthorized: (action) =>
    new BusinessError(
      ErrorCode.NOT_AUTHORIZED,
      `当前用户无权限执行【${action}】操作。`,
      {
        action,
        suggestion: '请联系管理员分配相应权限，或由授权人员代为操作。'
      }
    ),

  frozenPresetCannotModify: (presetName) =>
    new BusinessError(
      ErrorCode.FROZEN_PRESET_CANNOT_MODIFY,
      `预设【${presetName}】已冻结，无法修改。`,
      {
        presetName,
        suggestion: '冻结版本为演出前确认版本，如需修改请先解冻并创建新版本。'
      }
    ),

  activePresetCannotRollback: () =>
    new BusinessError(
      ErrorCode.ACTIVE_PRESET_CANNOT_ROLLBACK,
      '当前激活的预设版本无法作为回滚目标。',
      {
        suggestion: '请选择一个已批准但未激活的历史版本进行回滚。'
      }
    ),

  invalidRequest: (reason) =>
    new BusinessError(
      ErrorCode.INVALID_REQUEST,
      `请求无效：${reason}。`,
      {
        reason,
        suggestion: '请检查请求参数格式是否正确。'
      }
    )
};

const errorHandler = (err, req, res, next) => {
  if (err instanceof BusinessError) {
    return res.status(400).json(err.toResponse());
  }
  console.error('Unexpected error:', err);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '系统内部错误，请联系技术支持。',
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = {
  BusinessError,
  createBusinessError,
  errorHandler
};

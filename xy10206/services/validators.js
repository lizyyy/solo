const { createBusinessError } = require('./errors');
const { PresetStatus, SceneStatus } = require('../models/types');

const validateCreatePreset = (data) => {
  const requiredFields = ['sceneId', 'version', 'name', 'lightPositions', 'createdBy'];
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw createBusinessError.missingRequiredFields(missing);
  }

  if (!data.lightPositions || typeof data.lightPositions !== 'object') {
    throw createBusinessError.invalidRequest('lightPositions 必须是对象格式');
  }

  const positions = Object.keys(data.lightPositions);
  if (positions.length === 0) {
    throw createBusinessError.invalidRequest('至少需要配置一个灯位参数');
  }

  positions.forEach(posName => {
    const pos = data.lightPositions[posName];
    if (!pos || typeof pos !== 'object') {
      throw createBusinessError.invalidLightPosition(posName, '参数格式错误');
    }
    if (pos.intensity === undefined || pos.intensity === null) {
      throw createBusinessError.invalidLightPosition(posName, '缺少 intensity（亮度）参数');
    }
    if (typeof pos.intensity !== 'number' || pos.intensity < 0 || pos.intensity > 100) {
      throw createBusinessError.invalidLightPosition(posName, `intensity 必须是 0-100 之间的数字，当前值: ${pos.intensity}`);
    }
    if (!pos.color) {
      throw createBusinessError.invalidLightPosition(posName, '缺少 color（颜色）参数');
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(pos.color)) {
      throw createBusinessError.invalidLightPosition(posName, `color 格式错误，应为十六进制颜色值（如 #FFFFFF），当前值: ${pos.color}`);
    }
    if (pos.pan !== undefined && (pos.pan < -180 || pos.pan > 180)) {
      throw createBusinessError.invalidLightPosition(posName, `pan（水平角度）必须在 -180 到 180 之间，当前值: ${pos.pan}`);
    }
    if (pos.tilt !== undefined && (pos.tilt < -90 || pos.tilt > 90)) {
      throw createBusinessError.invalidLightPosition(posName, `tilt（垂直角度）必须在 -90 到 90 之间，当前值: ${pos.tilt}`);
    }
  });

  return true;
};

const validateSubmitForApproval = (data) => {
  const requiredFields = ['presetId', 'requestedBy', 'reason'];
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw createBusinessError.missingRequiredFields(missing);
  }
  return true;
};

const validateApprovalDecision = (data) => {
  const requiredFields = ['approvalId', 'approvedBy', 'decision'];
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw createBusinessError.missingRequiredFields(missing);
  }
  if (!['APPROVE', 'REJECT'].includes(data.decision)) {
    throw createBusinessError.invalidRequest('decision 必须是 APPROVE 或 REJECT');
  }
  return true;
};

const validateSceneLock = (data) => {
  const requiredFields = ['sceneId', 'lockedBy', 'reason'];
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw createBusinessError.missingRequiredFields(missing);
  }
  return true;
};

const validateRollback = (data) => {
  const requiredFields = ['sceneId', 'targetPresetId', 'rolledBackBy', 'reason'];
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw createBusinessError.missingRequiredFields(missing);
  }
  return true;
};

const isValidPresetStatusTransition = (from, to) => {
  const validTransitions = {
    [PresetStatus.DRAFT]: [PresetStatus.PENDING],
    [PresetStatus.PENDING]: [PresetStatus.APPROVED, PresetStatus.DRAFT, PresetStatus.REJECTED],
    [PresetStatus.APPROVED]: [PresetStatus.FROZEN, PresetStatus.ACTIVE],
    [PresetStatus.FROZEN]: [PresetStatus.ACTIVE, PresetStatus.APPROVED],
    [PresetStatus.ACTIVE]: [PresetStatus.FROZEN]
  };
  return validTransitions[from]?.includes(to) || false;
};

module.exports = {
  validateCreatePreset,
  validateSubmitForApproval,
  validateApprovalDecision,
  validateSceneLock,
  validateRollback,
  isValidPresetStatusTransition
};

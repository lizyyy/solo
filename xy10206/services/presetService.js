const { database, generateId } = require('../models/database');
const { PresetStatus, ApprovalStatus } = require('../models/types');
const { createBusinessError } = require('./errors');
const { validateCreatePreset, isValidPresetStatusTransition } = require('./validators');
const sceneService = require('./sceneService');

const getAllPresets = (sceneId) => {
  let presets = Array.from(database.presets.values());
  if (sceneId) {
    presets = presets.filter(p => p.sceneId === sceneId);
  }
  return presets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const getPresetById = (presetId) => {
  const preset = database.presets.get(presetId);
  if (!preset) {
    throw createBusinessError.presetNotFound(presetId);
  }
  return preset;
};

const createPreset = (data) => {
  validateCreatePreset(data);
  
  sceneService.checkSceneEditable(data.sceneId);
  
  const scene = database.scenes.get(data.sceneId);
  const existingPresets = Array.from(database.presets.values())
    .filter(p => p.sceneId === data.sceneId && p.version === data.version);
  
  if (existingPresets.length > 0) {
    throw createBusinessError.presetAlreadyExists(data.version, scene.name);
  }
  
  const id = generateId('preset');
  const preset = {
    id,
    sceneId: data.sceneId,
    version: data.version,
    name: data.name,
    description: data.description || '',
    status: PresetStatus.DRAFT,
    lightPositions: data.lightPositions,
    createdBy: data.createdBy,
    createdAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null
  };
  
  database.presets.set(id, preset);
  return {
    preset,
    message: `预设版本【${data.version}】创建成功，当前状态：草稿`
  };
};

const updatePreset = (presetId, data) => {
  const preset = getPresetById(presetId);
  
  if (preset.status === PresetStatus.FROZEN) {
    throw createBusinessError.frozenPresetCannotModify(preset.name);
  }
  
  if (preset.status === PresetStatus.ACTIVE) {
    throw createBusinessError.invalidPresetStatus(preset.status, [PresetStatus.DRAFT, PresetStatus.PENDING]);
  }
  
  sceneService.checkSceneEditable(preset.sceneId);
  
  if (data.lightPositions) {
    validateCreatePreset({
      sceneId: preset.sceneId,
      version: preset.version,
      name: preset.name,
      lightPositions: data.lightPositions,
      createdBy: preset.createdBy
    });
  }
  
  if (data.name) preset.name = data.name;
  if (data.description !== undefined) preset.description = data.description;
  if (data.lightPositions) preset.lightPositions = data.lightPositions;
  preset.updatedAt = new Date().toISOString();
  
  return {
    preset,
    message: `预设【${preset.name}】已更新`
  };
};

const updatePresetStatus = (presetId, newStatus, operator, comment = '') => {
  const preset = getPresetById(presetId);
  
  if (!isValidPresetStatusTransition(preset.status, newStatus)) {
    throw createBusinessError.invalidStateTransition(preset.status, newStatus);
  }
  
  const oldStatus = preset.status;
  preset.status = newStatus;
  preset.statusUpdatedAt = new Date().toISOString();
  preset.statusUpdatedBy = operator;
  
  if (newStatus === PresetStatus.APPROVED) {
    preset.approvedBy = operator;
    preset.approvedAt = new Date().toISOString();
  }
  
  if (newStatus === PresetStatus.FROZEN) {
    preset.frozenBy = operator;
    preset.frozenAt = new Date().toISOString();
  }
  
  return {
    preset,
    message: `预设状态已从【${oldStatus}】变更为【${newStatus}】，操作人：${operator}`
  };
};

const freezePreset = (presetId, operator) => {
  const preset = getPresetById(presetId);
  sceneService.checkSceneEditable(preset.sceneId);
  return updatePresetStatus(presetId, PresetStatus.FROZEN, operator);
};

const activatePreset = (presetId, operator) => {
  const preset = getPresetById(presetId);
  
  if (preset.status !== PresetStatus.APPROVED && preset.status !== PresetStatus.FROZEN) {
    throw createBusinessError.invalidPresetStatus(preset.status, [PresetStatus.APPROVED, PresetStatus.FROZEN]);
  }
  
  sceneService.checkSceneEditable(preset.sceneId);
  
  const scene = database.scenes.get(preset.sceneId);
  
  const oldActivePreset = scene.activePresetId ? database.presets.get(scene.activePresetId) : null;
  if (oldActivePreset && oldActivePreset.status === PresetStatus.ACTIVE) {
    oldActivePreset.status = PresetStatus.FROZEN;
  }
  
  scene.activePresetId = presetId;
  preset.status = PresetStatus.ACTIVE;
  preset.activatedBy = operator;
  preset.activatedAt = new Date().toISOString();
  
  return {
    preset,
    scene,
    message: `预设【${preset.name}】(${preset.version}) 已激活为场景【${scene.name}】的当前生效版本`
  };
};

const rollbackPreset = (data) => {
  const { sceneId, targetPresetId, rolledBackBy, reason } = data;
  
  const scene = database.scenes.get(sceneId);
  if (!scene) {
    throw createBusinessError.sceneNotFound(sceneId);
  }
  
  sceneService.checkSceneEditable(sceneId);
  
  const targetPreset = database.presets.get(targetPresetId);
  if (!targetPreset) {
    throw createBusinessError.presetNotFound(targetPresetId);
  }
  
  if (targetPreset.sceneId !== sceneId) {
    throw createBusinessError.invalidRequest('回滚目标预设不属于当前场景');
  }
  
  if (scene.activePresetId === targetPresetId) {
    throw createBusinessError.activePresetCannotRollback();
  }
  
  if (targetPreset.status !== PresetStatus.APPROVED && targetPreset.status !== PresetStatus.FROZEN && targetPreset.status !== PresetStatus.ACTIVE) {
    throw createBusinessError.invalidPresetStatus(targetPreset.status, [PresetStatus.APPROVED, PresetStatus.FROZEN]);
  }
  
  const currentActivePreset = scene.activePresetId ? database.presets.get(scene.activePresetId) : null;
  
  const rollbackRecord = {
    id: generateId('rollback'),
    sceneId,
    fromPresetId: scene.activePresetId,
    toPresetId: targetPresetId,
    fromVersion: currentActivePreset?.version,
    toVersion: targetPreset.version,
    rolledBackBy,
    reason,
    rolledBackAt: new Date().toISOString()
  };
  
  if (!database.rollbacks) database.rollbacks = new Map();
  database.rollbacks.set(rollbackRecord.id, rollbackRecord);
  
  if (currentActivePreset) {
    currentActivePreset.status = PresetStatus.FROZEN;
  }
  
  scene.activePresetId = targetPresetId;
  targetPreset.status = PresetStatus.ACTIVE;
  targetPreset.activatedBy = rolledBackBy;
  targetPreset.activatedAt = new Date().toISOString();
  targetPreset.rollbackFrom = currentActivePreset?.id;
  
  return {
    rollback: rollbackRecord,
    preset: targetPreset,
    scene,
    message: `已回滚至版本【${targetPreset.version}】(${targetPreset.name})，原版本【${currentActivePreset?.version || '无'}】已冻结`
  };
};

const deletePreset = (presetId, operator) => {
  const preset = getPresetById(presetId);
  
  if (preset.status === PresetStatus.ACTIVE) {
    throw createBusinessError.invalidPresetStatus(preset.status, [PresetStatus.DRAFT, PresetStatus.PENDING]);
  }
  
  if (preset.status === PresetStatus.FROZEN) {
    throw createBusinessError.frozenPresetCannotModify(preset.name);
  }
  
  const scene = database.scenes.get(preset.sceneId);
  if (scene.activePresetId === presetId) {
    scene.activePresetId = null;
  }
  
  database.presets.delete(presetId);
  
  return {
    message: `预设【${preset.name}】(${preset.version}) 已由【${operator}】删除`
  };
};

module.exports = {
  getAllPresets,
  getPresetById,
  createPreset,
  updatePreset,
  updatePresetStatus,
  freezePreset,
  activatePreset,
  rollbackPreset,
  deletePreset
};

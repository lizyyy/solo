const { database, generateId } = require('../models/database');
const { SceneStatus, PresetStatus, ApprovalStatus } = require('../models/types');
const { createBusinessError } = require('./errors');
const { validateSceneLock } = require('./validators');

const getAllScenes = () => {
  return Array.from(database.scenes.values()).map(scene => ({
    ...scene,
    presetCount: Array.from(database.presets.values()).filter(p => p.sceneId === scene.id).length
  }));
};

const getSceneById = (sceneId) => {
  const scene = database.scenes.get(sceneId);
  if (!scene) {
    throw createBusinessError.sceneNotFound(sceneId);
  }
  return {
    ...scene,
    activePreset: scene.activePresetId ? database.presets.get(scene.activePresetId) : null
  };
};

const createScene = (data) => {
  const id = generateId('scene');
  const scene = {
    id,
    name: data.name,
    description: data.description || '',
    status: SceneStatus.UNLOCKED,
    lockedBy: null,
    lockedAt: null,
    activePresetId: null,
    createdAt: new Date().toISOString()
  };
  database.scenes.set(id, scene);
  return scene;
};

const lockScene = (data) => {
  validateSceneLock(data);
  const scene = database.scenes.get(data.sceneId);
  if (!scene) {
    throw createBusinessError.sceneNotFound(data.sceneId);
  }
  if (scene.status === SceneStatus.LOCKED) {
    throw createBusinessError.sceneLocked(scene.name, scene.lockedBy);
  }
  scene.status = SceneStatus.LOCKED;
  scene.lockedBy = data.lockedBy;
  scene.lockedAt = new Date().toISOString();
  scene.lockReason = data.reason;
  return {
    scene,
    message: `场景【${scene.name}】已被【${data.lockedBy}】锁定，原因：${data.reason}`
  };
};

const unlockScene = (data) => {
  const scene = database.scenes.get(data.sceneId);
  if (!scene) {
    throw createBusinessError.sceneNotFound(data.sceneId);
  }
  if (scene.status === SceneStatus.UNLOCKED) {
    return {
      scene,
      message: `场景【${scene.name}】当前已是解锁状态`
    };
  }
  scene.status = SceneStatus.UNLOCKED;
  scene.unlockedBy = data.unlockedBy || '系统';
  scene.unlockedAt = new Date().toISOString();
  scene.unlockReason = data.reason || '';
  return {
    scene,
    message: `场景【${scene.name}】已被【${data.unlockedBy || '系统'}】解锁`
  };
};

const checkSceneEditable = (sceneId) => {
  const scene = database.scenes.get(sceneId);
  if (!scene) {
    throw createBusinessError.sceneNotFound(sceneId);
  }
  if (scene.status === SceneStatus.LOCKED) {
    throw createBusinessError.sceneLocked(scene.name, scene.lockedBy);
  }
  return scene;
};

module.exports = {
  getAllScenes,
  getSceneById,
  createScene,
  lockScene,
  unlockScene,
  checkSceneEditable
};
